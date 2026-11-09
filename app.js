import { analyzeText } from "./engine/analyzer.js";
import { evaluate, LABELS } from "./engine/evaluator.js";
import { displayLabel, displayResult, abstainExplanation, skipReasonText, isBlankInput } from "./ui/labels.js";
import {
  USER_CATEGORY, LIMITS, validateEntry, warningsFor, selectableCategories, mergeUserDictionary,
  suggestStem, isNegatedForm, previewEntry, NEGATION_ADVICE, mergeImported, importMessage,
  upsertEntry, removeEntry, serialize, parseImport, loadEntries, saveEntries
} from "./ui/userDictionary.js";
import { splitCategoryScores, formatScore, scoreClass } from "./ui/breakdown.js";
import { isAnalyzeShortcut, shortcutLabel, needsScrollToResult } from "./ui/interaction.js";
import { highlightSegments, meterPosition, meterLabel, METER_RANGE } from "./ui/visual.js";

// 文中の語の印の種類 → 読み上げ・凡例の言葉
const MARK_TEXT = { positive: "ポジティブ", negative: "ネガティブ", zero: "どちらでもない", skipped: "数えなかった語" };

// Ctrl+Enter / ⌘+Enter の表示（userAgentData がなければ従来の platform）
const SHORTCUT_LABEL = shortcutLabel(navigator.userAgentData?.platform || navigator.platform || "");
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// ===== 感情辞書（data/config.json）: 一度だけ読み込み、画面間で共有する =====
// status: "loading" / "ready" / "failed"（失敗したら「再読み込み」で再試行できる）
const appState = Vue.reactive({ config: null, status: "loading" });
let configPromise = null;
function loadConfig() {
  if (!configPromise) {
    appState.status = "loading";
    configPromise = fetch("./data/config.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((config) => {
        appState.config = Vue.markRaw(config);
        appState.status = "ready";
        initUserDictionary(config);
        return config;
      })
      .catch((err) => {
        console.warn("辞書を読み込めませんでした:", err);
        configPromise = null;   // 「再読み込み」で再試行できるように
        appState.status = "failed";
        throw err;
      });
  }
  return configPromise;
}

// ===== 形態素解析（kuromoji）: 既定はオフ（文字列モード）。オンにしたときだけ本体と辞書（約18MB）を読み込む =====
// status: "off"（使わない） / "loading" / "ready" / "failed"（読み込み失敗 → 文字列モード）
const morph = Vue.reactive({ status: "off", tokenizer: null });
const MORPH_PREF_KEY = "morphology";

// 閲覧者ごとの設定（ブラウザに保存）。保存できない環境でも動くように try/catch で囲む
function readMorphPref() {
  try { return localStorage.getItem(MORPH_PREF_KEY) === "on"; } catch { return false; }
}
function writeMorphPref(on) {
  try { localStorage.setItem(MORPH_PREF_KEY, on ? "on" : "off"); } catch { /* 保存できなくても動作は続ける */ }
}

// kuromoji 本体を、SRI 付きで必要になったときだけ読み込む（URL とハッシュは data/kuromoji-dict.json）
function loadScript({ src, integrity }) {
  if (typeof kuromoji !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.integrity = integrity;
    el.crossOrigin = "anonymous";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`読み込みに失敗しました: ${src}`));
    document.head.appendChild(el);
  });
}

let tokenizerPromise = null;
function enableMorphology() {
  writeMorphPref(true);
  if (morph.tokenizer) { morph.status = "ready"; return; }
  morph.status = "loading";
  tokenizerPromise ??= fetch("./data/kuromoji-dict.json")
    .then((res) => res.json())
    .then((manifest) => loadScript(manifest.script).then(() => manifest))
    .then((manifest) => new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: manifest.base }).build((err, tokenizer) => (err ? reject(err) : resolve(tokenizer)));
    }));
  tokenizerPromise
    .then((tokenizer) => {
      morph.tokenizer = Vue.markRaw(tokenizer);
      if (morph.status === "loading") morph.status = "ready";   // 読み込み中にオフにされたら、オフのまま
    })
    .catch((err) => {
      console.warn("形態素解析を使えません（文字列モードで動作します）:", err);
      tokenizerPromise = null;   // 次にオンにしたとき再試行できるように
      if (morph.status === "loading") morph.status = "failed";
    });
}
function disableMorphology() {
  writeMorphPref(false);
  morph.status = "off";
}
// 分析に使う tokenizer（オンで、読み込み済みのときだけ）
const activeTokenizer = () => (morph.status === "ready" ? morph.tokenizer : null);

if (readMorphPref()) enableMorphology();

const MORPH_LABELS = {
  off: "使っていません（文字列モード）",
  loading: "辞書を読み込み中（約18MB）… その間は文字列モードで分析します",
  ready: "有効",
  failed: "読み込めませんでした（文字列モードで分析しています）"
};

// ===== ユーザー辞書: 閲覧者のブラウザに保存（画面間で共有）。評価（#/dev のテスト評価）には使わない =====
const browserStorage = (() => { try { return window.localStorage; } catch { return null; } })();
const userDict = Vue.reactive({ entries: [], categories: [], loaded: false });
function initUserDictionary(config) {
  if (userDict.loaded) return;
  userDict.categories = selectableCategories(config);
  userDict.entries = loadEntries(browserStorage, userDict.categories);
  userDict.loaded = true;
}
loadConfig().catch(() => { /* 画面に「読み込めませんでした」を表示する */ });
function setUserEntries(entries) {
  userDict.entries = entries;
  return saveEntries(browserStorage, entries);
}

const UserDictionaryPanel = {
  template: `
    <details class="user-dict" :open="open" @toggle="open = $event.target.open">
      <summary>ユーザー辞書（{{ dict.entries.length }} / {{ limits.maxEntries }} 語）</summary>
      <p class="muted">
        辞書にない自分の分野の語を追加できます。語は活用で変わらない部分（例: 「コシがある」→「コシがあ」）で登録します。
        このブラウザにだけ保存されます（残す・共有するには「書き出し」）。
      </p>
      <form class="user-dict-form" @submit.prevent="add">
        <input v-model="word" placeholder="語（例: コシがあ）" aria-label="語" maxlength="40">
        <input v-model.number="polarity" type="number" step="0.1" :min="limits.minPolarity" :max="limits.maxPolarity" aria-label="極性">
        <select v-model="category" aria-label="カテゴリ">
          <option v-for="c in dict.categories" :key="c" :value="c">{{ c }}</option>
        </select>
        <button type="submit" class="small">追加</button>
      </form>
      <div class="dict-advice" aria-live="polite">
        <p v-if="stem" class="advice">
          「{{ trimmedWord }}」のままだと、活用した形（〜た・〜て など）には一致しません。
          変わらない部分「{{ stem }}」で登録すると、どの形にも一致します。
          <button type="button" class="small" @click="useStem">「{{ stem }}」にする</button>
        </p>
        <p v-if="negatedForm" class="advice">{{ negationAdvice }}</p>
        <p v-if="preview" :class="['preview', preview.status]">
          <template v-if="preview.status === 'counted'">
            ✓ 入力中の文で見つかり、判定に使われます<template v-if="polarityValid">（<template v-if="preview.negated">否定されているため </template>{{ formatScore(preview.polarity) }}）</template>。
          </template>
          <template v-else-if="preview.status === 'skipped'">
            △ 入力中の文で見つかりますが、数えません（{{ skipReasonText(preview) }}）。
          </template>
          <template v-else-if="preview.status === 'covered'">
            △ 入力中の文にありますが、<template v-if="preview.by">より長い辞書の語「{{ preview.by }}」</template><template v-else>別の語</template>の一部として扱われるため、使われません。
          </template>
          <template v-else>
            ✗ 入力中の文には見つかりません。<template v-if="stemFound">「{{ stem }}」なら見つかります。</template>
          </template>
        </p>
        <p v-else-if="trimmedWord && !hasText" class="muted">上の入力欄に文を入れると、その文で一致するかを追加する前に確かめられます。</p>
      </div>
      <p class="muted">極性: 肯定は 0.5〜1.0、否定は −0.5〜−1.0 が目安（範囲 {{ limits.minPolarity }}〜{{ limits.maxPolarity }}）。</p>
      <ul v-if="errors.length" class="form-errors"><li v-for="e in errors" :key="e">{{ e }}</li></ul>
      <ul v-if="warnings.length" class="form-warnings"><li v-for="w in warnings" :key="w">{{ w }}</li></ul>
      <p v-if="message" class="muted">{{ message }}</p>

      <table v-if="dict.entries.length" class="user-dict-table">
        <tr><th>語</th><th>極性</th><th>カテゴリ</th><th><span class="visually-hidden">操作</span></th></tr>
        <tr v-for="e in dict.entries" :key="e.word">
          <td>{{ e.word }}</td>
          <td :class="e.polarity > 0 ? 'pos-text' : 'neg-text'">{{ e.polarity > 0 ? "+" : "" }}{{ e.polarity }}</td>
          <td>{{ e.category }}</td>
          <td><button type="button" class="link" @click="remove(e.word)" :aria-label="e.word + ' を削除'">削除</button></td>
        </tr>
      </table>

      <div class="user-dict-io">
        <button type="button" class="small" @click="exportJson" :disabled="!dict.entries.length">書き出し（JSON）</button>
        <label class="small file-label">
          読み込み（JSON）
          <input type="file" accept="application/json,.json" @change="importJson">
        </label>
      </div>
    </details>
  `,
  // text: 分析パネルの入力中の文（追加する前に、その文で一致するかを確かめる）
  props: { text: { type: String, default: "" } },
  data() {
    return { dict: userDict, limits: LIMITS, word: "", polarity: 0.8, category: USER_CATEGORY, errors: [], warnings: [], message: "", open: false, negationAdvice: NEGATION_ADVICE };
  },
  computed: {
    trimmedWord() {
      return this.word.trim();
    },
    hasText() {
      return !isBlankInput(this.text);
    },
    stem() {
      return suggestStem(this.trimmedWord);
    },
    stemFound() {
      return Boolean(this.stem && this.text.includes(this.stem));
    },
    negatedForm() {
      return isNegatedForm(this.trimmedWord);
    },
    polarityValid() {
      return typeof this.polarity === "number" && Number.isFinite(this.polarity) && this.polarity !== 0;
    },
    // 入力中の語が、入力中の文でどう扱われるか（形態素解析の設定も同じものを使う）
    preview() {
      if (!appState.config || /\s/.test(this.trimmedWord)) return null;
      return previewEntry(
        { word: this.trimmedWord, polarity: this.polarity, category: this.category },
        this.text, appState.config, this.dict.entries, { tokenizer: activeTokenizer() }
      );
    }
  },
  methods: {
    formatScore,
    skipReasonText,
    useStem() {
      this.word = this.stem;
    },
    add() {
      const entry = { word: this.word.trim(), polarity: this.polarity, category: this.category };
      this.errors = validateEntry(entry, this.dict.categories);
      this.warnings = this.errors.length ? [] : warningsFor(entry);
      this.message = "";
      if (this.errors.length) return;
      try {
        const saved = setUserEntries(upsertEntry(this.dict.entries, entry));
        this.message = saved ? `「${entry.word}」を追加しました` : `「${entry.word}」を追加しました（このブラウザには保存できないため、ページを閉じると消えます）`;
        this.word = "";
      } catch (err) {
        this.errors = [err.message];
        this.message = "";
      }
    },
    remove(word) {
      setUserEntries(removeEntry(this.dict.entries, word));
      this.errors = [];
      this.message = `「${word}」を削除しました`;
    },
    exportJson() {
      const url = URL.createObjectURL(new Blob([serialize(this.dict.entries)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "user-dictionary.json" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    async importJson(event) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const { entries, rejected } = parseImport(await file.text(), this.dict.categories);
        const merged = mergeImported(this.dict.entries, entries);
        setUserEntries(merged.entries);
        this.errors = [];
        this.message = importMessage(merged, rejected);
      } catch (err) {
        this.errors = [err.message];
        this.message = "";
      }
    },
    openPanel() {
      this.open = true;
    }
  }
};

const EXAMPLES = [
  "麺がもちもちで美味しく、店員さんも親切だった",
  "届いて一週間で電源が入らなくなった",
  "期待外れで、二度と買わない",
  "動かない場合は、販売店にご連絡ください"
];

// ===== 分析パネル（一般向け・開発者向けで共通） =====
const AnalysisPanel = {
  props: { dev: { type: Boolean, default: false } },
  template: `
    <div>
      <textarea ref="input" v-model="text" rows="4" placeholder="レビューの文を入力..." aria-label="レビューの文"
                aria-keyshortcuts="Control+Enter Meta+Enter" @keydown="onKeydown"
                :aria-invalid="inputError ? 'true' : null" :aria-describedby="inputError ? 'input-error' : null"></textarea>
      <p v-if="inputError" id="input-error" class="input-error" role="alert">{{ inputError }}</p>

      <div class="examples">
        <span class="examples-label">例文:</span>
        <button v-for="ex in examples" :key="ex" class="chip" type="button" @click="tryExample(ex)">{{ ex }}</button>
      </div>

      <button class="primary" type="button" @click="analyze" :disabled="appState.status !== 'ready'">
        {{ appState.status === "loading" ? "辞書を読み込み中…" : "分析" }}
      </button>
      <p class="shortcut-hint">入力欄で {{ shortcutLabel }} を押しても分析できます</p>
      <div v-if="appState.status === 'failed'" class="load-error" role="alert">
        <p>辞書（感情を表す語の一覧）を読み込めませんでした。通信状況を確認して、もう一度お試しください。</p>
        <button type="button" class="small" @click="retryConfig">再読み込み</button>
      </div>
      <div class="morph-toggle">
        <label>
          <input type="checkbox" :checked="morph.status !== 'off'" @change="toggleMorph($event.target.checked)">
          形態素解析を使う（辞書 約18MB をダウンロード）
        </label>
        <span :class="['morph-status', morph.status]">{{ morphLabels[morph.status] }}</span>
      </div>

      <!-- 判定を読み上げる（結果のブロックは毎回作り直されるため、常にある領域で知らせる） -->
      <p class="visually-hidden" role="status" aria-live="polite">{{ announcement }}</p>
      <p v-if="stale" class="stale-notice" role="status">
        入力が変わりました。下の結果は前の文のものです。「分析」を押すと結果を更新します。
      </p>
      <div v-if="r" ref="results" :class="['results', { stale }]">
        <div :class="['result', label.cssClass]">{{ label.text }}</div>
        <p v-if="abstain" class="score-line">
          <template v-if="abstain.kind === 'contrast'">
            「{{ abstain.marker }}」より後に、評価を表す辞書の語が見つかりませんでした。
            「{{ abstain.marker }}」より前の語（{{ abstain.words.join("・") }}）は、後半を優先するため数えていません。
          </template>
          <template v-else-if="abstain.kind === 'notCounted'">
            辞書の語（{{ abstain.words.join("・") }}）は見つかりましたが、条件・説明の中にあるか別の意味で使われているため、数えていません。
          </template>
          <template v-else-if="abstain.kind === 'zeroOnly'">
            見つかった語（{{ abstain.words.join("・") }}）は、ポジティブにもネガティブにも働かない語でした。
          </template>
          <template v-else>辞書に感情を表す語が見つかりませんでした。</template>
          <strong>中立という判定ではありません。</strong><br>
          <button type="button" class="link" @click="openUserDictionary">ユーザー辞書</button>に語を追加すると、判定できるようになります。
        </p>
        <p v-else class="score-line">
          判定スコア {{ r.normalizedScore.toFixed(2) }}（±{{ r.threshold }} 以上でポジティブ／ネガティブ）
          <template v-if="r.contrastMarker"><br>「{{ r.contrastMarker }}」より後の内容を優先して判定しました。</template>
        </p>

        <!-- 判定スコアのメーター（天秤の傾き）: 中央が 0、左右の色の帯が判定の範囲 -->
        <div v-if="!r.abstained" class="meter" role="img" :aria-label="meterAria">
          <div class="meter-track">
            <span class="meter-zone negative" :style="{ left: '0%', width: meter.negativeEnd + '%' }"></span>
            <span class="meter-zone neutral" :style="{ left: meter.negativeEnd + '%', width: (meter.positiveStart - meter.negativeEnd) + '%' }"></span>
            <span class="meter-zone positive" :style="{ left: meter.positiveStart + '%', right: '0%' }"></span>
            <span :class="['meter-marker', meter.zone, { clamped: meter.clamped }]" :style="{ left: meter.percent + '%' }"></span>
          </div>
          <div class="meter-labels" aria-hidden="true">
            <span>ネガティブ</span><span>中立</span><span>ポジティブ</span>
          </div>
          <p v-if="meter.clamped" class="meter-note" aria-hidden="true">目盛り（±{{ meterRange }}）の外のため、端に表示しています</p>
        </div>

        <section v-if="hasMarks" class="section">
          <h3>文中の語</h3>
          <p class="highlighted"><template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.kind" :class="['hl', seg.kind]" :title="seg.title">{{ seg.text }}<span class="visually-hidden">（{{ markText[seg.kind] }}）</span></mark><template v-else>{{ seg.text }}</template></template></p>
          <p class="hl-legend" aria-hidden="true">
            <mark class="hl positive">ポジティブ</mark>
            <mark class="hl negative">ネガティブ</mark>
            <mark class="hl skipped">数えなかった語</mark>
          </p>
        </section>

        <section v-if="breakdown.aspects.length" class="section">
          <h3>観点別（何が良く、何が悪かったか）</h3>
          <div class="chips">
            <span v-for="a in breakdown.aspects" :key="a.category" :class="['chip', 'score-chip', scoreClass(a.score)]">
              {{ a.category }} {{ formatScore(a.score) }}
            </span>
          </div>
        </section>

        <section v-if="breakdown.emotions.length" class="section">
          <h3>感情・評価</h3>
          <div class="chips">
            <span v-for="e in breakdown.emotions" :key="e.category" :class="['chip', 'score-chip', scoreClass(e.score)]">
              {{ e.category }} {{ formatScore(e.score) }}
            </span>
          </div>
        </section>

        <section v-if="r.matchedWords.length" class="section">
          <h3>判定の根拠</h3>
          <ul>
            <li v-for="m in r.matchedWords" :key="m.word">
              <span v-if="userWords.has(m.word)" class="badge">ユーザー</span>
              <strong>{{ m.word }}</strong>（{{ m.category }} /
              <template v-if="m.negatedOnly">否定 → {{ m.negatedPolarity }}</template>
              <template v-else>
                {{ m.base }}
                <span v-if="m.negated">→ {{ -m.base }} 否定</span>
              </template>
              <span v-if="m.multiplier !== 1">×{{ m.multiplier }}</span>
              = {{ m.polarity.toFixed(2) }}）
            </li>
          </ul>
        </section>

        <section v-if="r.skippedWords.length" class="section">
          <h3>数えなかった語（理由つき）</h3>
          <ul>
            <li v-for="(s, i) in r.skippedWords" :key="i">
              {{ s.word }}（{{ s.category }} / {{ skipReasonText(s) }}）
            </li>
          </ul>
        </section>

        <section v-if="dev" class="section dev-only">
          <h3>デバッグ</h3>
          <p>debug: {{ r.debugLabel }} / 形態素解析: {{ r.morphology ? "有効" : "無効" }} / 合計 {{ r.score.toFixed(2) }} ÷ √ヒット数 {{ r.hits }}</p>
          <pre>{{ JSON.stringify(r, null, 2) }}</pre>
        </section>
      </div>

      <user-dictionary-panel ref="userDictionary" :text="text"></user-dictionary-panel>
    </div>
  `,
  components: { UserDictionaryPanel },
  data() {
    // analyzedText: 表示中の結果の元になった文（入力欄が変わっても、結果はこの文のもの）
    return { text: "", analyzedText: "", r: null, inputError: "", examples: EXAMPLES, morph, morphLabels: MORPH_LABELS, userDict, appState, shortcutLabel: SHORTCUT_LABEL, markText: MARK_TEXT, meterRange: METER_RANGE };
  },
  computed: {
    config() {
      return this.appState.config;
    },
    label() {
      return displayResult(this.r);
    },
    abstain() {
      return abstainExplanation(this.r);
    },
    meter() {
      return meterPosition(this.r?.normalizedScore, this.r?.threshold ?? 0.5);
    },
    meterAria() {
      return this.r ? meterLabel(this.r.normalizedScore, this.r.threshold) + (this.meter.clamped ? `（目盛り ±${METER_RANGE} の外）` : "") : "";
    },
    // 分析した文（入力欄が変わっていても、結果の元の文）に、語の印を付けたもの
    segments() {
      return this.r ? highlightSegments(this.analyzedText, this.r) : [];
    },
    hasMarks() {
      return this.segments.some((seg) => seg.kind);
    },
    // 読み上げる文: 判定と、判定スコア（判定できないときは、中立ではないこと）
    announcement() {
      if (!this.r) return "";
      if (this.abstain) return "判定できません。中立という判定ではありません。";
      return `判定: ${this.label.text}。判定スコア ${this.r.normalizedScore.toFixed(2)}。`;
    },
    // 結果を表示したあとに入力欄が変わった（結果は前の文のもの）
    stale() {
      return Boolean(this.r) && this.text !== this.analyzedText;
    },
    // 組み込み辞書 ＋ ユーザー辞書
    effectiveConfig() {
      return this.config && mergeUserDictionary(this.config, this.userDict.entries);
    },
    userWords() {
      return new Set(this.userDict.entries.map((e) => e.word));
    },
    breakdown() {
      return splitCategoryScores(this.r?.categoryScore, this.config?.groups);
    }
  },
  watch: {
    // 形態素解析の状態が変わったら（読み込み完了・オフにした など）、表示中の結果を分析し直す
    "morph.status"() {
      this.reanalyze();
    },
    // ユーザー辞書を変えたら、表示中の結果を分析し直す
    "userDict.entries"() {
      this.reanalyze();
    },
    // 入力を始めたら、空入力の案内を消す
    text() {
      if (this.inputError && !isBlankInput(this.text)) this.inputError = "";
    }
  },
  methods: {
    formatScore,
    scoreClass,
    skipReasonText,
    // 「分析」ボタン・Ctrl+Enter・例文: 空の入力は判定せず、入力を促す（「判定できません」とは表示しない）
    analyze() {
      if (!this.config) return;
      if (isBlankInput(this.text)) {
        this.r = null;
        this.inputError = "分析するレビューの文を入力してください（例文を押しても試せます）。";
        this.$refs.input.focus();
        return;
      }
      this.inputError = "";
      this.runAnalysis(this.text);
      this.$nextTick(() => this.scrollToResult());
    },
    // 設定（ユーザー辞書・形態素解析）が変わったときの再分析。
    // 表示中の結果の元の文で分析し直す（入力欄を書き換え中でも、結果と元の文がずれないように）。フォーカスもスクロールも動かさない
    reanalyze() {
      if (this.r && this.config) this.runAnalysis(this.analyzedText);
    },
    runAnalysis(text) {
      const r = analyzeText(text, this.effectiveConfig, { tokenizer: activeTokenizer() });
      this.r = { ...r, skippedWords: r.skippedWords ?? [] };
      this.analyzedText = text;
    },
    onKeydown(event) {
      if (!isAnalyzeShortcut(event)) return;
      event.preventDefault();
      this.analyze();
    },
    // 結果が画面の下の方（スマホなど）にあれば、結果の先頭までスクロールする
    scrollToResult() {
      const el = this.$refs.results;
      if (!el || !needsScrollToResult(el.getBoundingClientRect().top, window.innerHeight)) return;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    },
    retryConfig() {
      loadConfig().catch(() => { /* 失敗は appState.status で表示 */ });
    },
    openUserDictionary() {
      this.$refs.userDictionary.openPanel();
      this.$nextTick(() => this.$refs.userDictionary.$el.scrollIntoView({ behavior: "smooth", block: "start" }));
    },
    toggleMorph(on) {
      on ? enableMorphology() : disableMorphology();
    },
    tryExample(ex) {
      this.text = ex;
      if (this.config) this.analyze();
    }
  }
};

// ===== 一般向け画面 =====
const Home = {
  components: { AnalysisPanel },
  template: `
    <main class="card">
      <img class="logo-mark" src="assets/mark.svg" alt="" width="56" height="56">
      <h1>Tenbin（天秤）<span class="subtitle">日本語レビュー感情分析</span></h1>
      <p class="tagline">理由が見える・ブラウザだけで動く</p>
      <analysis-panel></analysis-panel>
      <footer class="footer">
        <router-link to="/dev">開発者向け（評価・デバッグ）</router-link>
        ・
        <a href="https://github.com/bowo-prasetyo/japanese-sentiment-analyzer">GitHub</a>
      </footer>
    </main>
  `
};

// ===== 開発者向け画面 =====
const TESTSETS = {
  dev: { name: "開発用セット", path: "./data/testset.json" },
  holdout: { name: "ホールドアウト", path: "./data/holdout.json" }
};

const Dev = {
  components: { AnalysisPanel },
  template: `
    <main class="card">
      <h1>開発者向け</h1>
      <p class="tagline"><router-link to="/">← 一般向け画面に戻る</router-link></p>

      <analysis-panel :dev="true"></analysis-panel>

      <section class="section">
        <h3>テスト評価</h3>
        <p class="muted">固定ブラインドベンチマーク（b1）はここには表示しません（npm run bench で集計のみ）。
          テスト評価は組み込み辞書だけで行います（ユーザー辞書は使いません）。
          形態素解析: {{ morph.status === "ready" ? "有効" : "無効（文字列モード）" }}</p>
        <button v-for="(s, key) in testsets" :key="key" class="primary" @click="runEvaluation(key)">
          テスト評価（{{ s.name }}）
        </button>
        <p v-if="evaluationError" class="load-error" role="alert">{{ evaluationError }}</p>
      </section>

      <div v-if="evaluation" class="stats">
        <p>📊 評価結果: {{ testsets[evaluationSet].name }}（{{ evaluation.total }}件）</p>
        <p class="headline">Macro-F1: {{ pct(evaluation.macroF1) }}</p>
        <p>Accuracy: {{ pct(evaluation.accuracy) }}</p>
        <p>判定できた割合（coverage）: {{ pct(evaluation.coverage) }} ／ 判定できた文での正解率: {{ pct(evaluation.accuracyOnDecided) }}</p>

        <table>
          <tr><th></th><th>Precision</th><th>Recall</th><th>F1</th><th>件数</th></tr>
          <tr v-for="l in labels" :key="l">
            <th>{{ display(l).text }}</th>
            <td>{{ pct(evaluation.perClass[l].precision) }}</td>
            <td>{{ pct(evaluation.perClass[l].recall) }}</td>
            <td>{{ pct(evaluation.perClass[l].f1) }}</td>
            <td>{{ evaluation.perClass[l].support }}</td>
          </tr>
        </table>

        <p>Confusion Matrix（行: 正解 / 列: 予測）</p>
        <table>
          <tr><th></th><th v-for="p in labels" :key="p">{{ display(p).text }}</th></tr>
          <tr v-for="g in labels" :key="g">
            <th>{{ display(g).text }}</th>
            <td v-for="p in labels" :key="p" :class="{ diag: g === p }">{{ evaluation.confusion[g][p] }}</td>
          </tr>
        </table>

        <p>❌ 誤判定（{{ evaluation.errorCases.length }}件）</p>
        <ul>
          <li v-for="(r, i) in evaluation.errorCases.slice(0, 20)" :key="i">
            <strong>{{ r.text }}</strong><br>
            正解: {{ display(r.label).text }} / 予測: {{ display(r.predicted).text }}<br>
            score: {{ r.normalizedScore.toFixed(2) }} / hits: {{ r.hits }}
          </li>
        </ul>

        <p>⚠️ ヒットなし（{{ evaluation.noHitCases.length }}件）</p>
        <ul>
          <li v-for="(r, i) in evaluation.noHitCases.slice(0, 20)" :key="i">{{ r.text }}</li>
        </ul>
      </div>
    </main>
  `,
  data() {
    return { evaluation: null, evaluationSet: "", evaluationError: "", testsets: TESTSETS, testsetData: {}, labels: LABELS, morph };
  },
  methods: {
    display: displayLabel,
    pct(x) {
      return (x * 100).toFixed(1) + "%";
    },
    async runEvaluation(key) {
      this.evaluationError = "";
      try {
        const config = await loadConfig();
        if (!this.testsetData[key]) {
          const res = await fetch(TESTSETS[key].path);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.testsetData[key] = await res.json();
        }
        this.evaluationSet = key;
        this.evaluation = evaluate(this.testsetData[key], config, { tokenizer: activeTokenizer() });
      } catch (err) {
        this.evaluationError = `${TESTSETS[key].name}を読み込めませんでした（${err.message}）。もう一度お試しください。`;
      }
    }
  }
};

// Router
const routes = [
  { path: "/", component: Home },
  { path: "/dev", component: Dev }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

// #app の中身（起動前の「読み込み中…」）は、このテンプレートで置き換える
const app = Vue.createApp({ template: "<router-view></router-view>" });
app.use(router);
app.mount("#app");
