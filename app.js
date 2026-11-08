import { analyzeText } from "./engine/analyzer.js";
import { evaluate, LABELS } from "./engine/evaluator.js";
import { displayLabel } from "./ui/labels.js";
import { splitCategoryScores, formatScore, scoreClass } from "./ui/breakdown.js";

// 辞書は一度だけ読み込み、画面間で共有する
let configPromise = null;
function loadConfig() {
  configPromise ??= fetch("./data/config.json").then((res) => res.json());
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

const EXAMPLES = [
  "麺がもちもちで美味しく、店員さんも親切だった",
  "届いて一週間で電源が入らなくなった",
  "期待外れで、二度と買わない",
  "動かない場合は、販売店にご連絡ください"
];

const SKIP_REASONS = { condition: "条件", description: "説明", usage: "用法" };

// ===== 分析パネル（一般向け・開発者向けで共通） =====
const AnalysisPanel = {
  props: { dev: { type: Boolean, default: false } },
  template: `
    <div>
      <textarea v-model="text" rows="4" placeholder="レビューの文を入力..."></textarea>

      <div class="examples">
        <span class="examples-label">例文:</span>
        <button v-for="ex in examples" :key="ex" class="chip" type="button" @click="tryExample(ex)">{{ ex }}</button>
      </div>

      <button class="primary" @click="analyze">分析</button>
      <div class="morph-toggle">
        <label>
          <input type="checkbox" :checked="morph.status !== 'off'" @change="toggleMorph($event.target.checked)">
          形態素解析を使う（辞書 約18MB をダウンロード）
        </label>
        <span :class="['morph-status', morph.status]">{{ morphLabels[morph.status] }}</span>
      </div>

      <template v-if="r">
        <div :class="['result', label.cssClass]">{{ label.text }}</div>
        <p class="score-line">
          判定スコア {{ r.normalizedScore.toFixed(2) }}（±{{ r.threshold }} 以上でポジティブ／ネガティブ）
        </p>

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

        <section class="section">
          <h3>判定の根拠</h3>
          <p v-if="!r.matchedWords.length" class="muted">辞書の語が見つからなかったため、中立と判定しました。</p>
          <ul v-else>
            <li v-for="m in r.matchedWords" :key="m.word">
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
          <h3>数えなかった語（書き手の評価ではない・別の意味のため）</h3>
          <ul>
            <li v-for="s in r.skippedWords" :key="s.word">
              {{ s.word }}（{{ s.category }} / {{ skipReasons[s.reason] }}「{{ s.marker }}」）
            </li>
          </ul>
        </section>

        <section v-if="dev" class="section dev-only">
          <h3>デバッグ</h3>
          <p>debug: {{ r.debugLabel }} / 形態素解析: {{ r.morphology ? "有効" : "無効" }} / 合計 {{ r.score.toFixed(2) }} ÷ √ヒット数 {{ r.hits }}</p>
          <pre>{{ JSON.stringify(r, null, 2) }}</pre>
        </section>
      </template>
    </div>
  `,
  data() {
    return { text: "", r: null, config: null, examples: EXAMPLES, skipReasons: SKIP_REASONS, morph, morphLabels: MORPH_LABELS };
  },
  computed: {
    label() {
      return displayLabel(this.r?.result);
    },
    breakdown() {
      return splitCategoryScores(this.r?.categoryScore, this.config?.groups);
    }
  },
  async mounted() {
    this.config = await loadConfig();
  },
  watch: {
    // 形態素解析の状態が変わったら（読み込み完了・オフにした など）、表示中の結果を分析し直す
    "morph.status"() {
      if (this.r) this.analyze();
    }
  },
  methods: {
    formatScore,
    scoreClass,
    analyze() {
      if (!this.config) return;
      const r = analyzeText(this.text, this.config, { tokenizer: activeTokenizer() });
      this.r = { ...r, skippedWords: r.skippedWords ?? [] };
    },
    toggleMorph(on) {
      on ? enableMorphology() : disableMorphology();
    },
    tryExample(ex) {
      this.text = ex;
      this.analyze();
    }
  }
};

// ===== 一般向け画面 =====
const Home = {
  components: { AnalysisPanel },
  template: `
    <div class="card">
      <h1>日本語レビュー感情分析</h1>
      <p class="tagline">理由が見える・ブラウザだけで動く</p>
      <analysis-panel></analysis-panel>
      <footer class="footer">
        <router-link to="/dev">開発者向け（評価・デバッグ）</router-link>
        ・
        <a href="https://github.com/bowo-prasetyo/japanese-sentiment-analyzer">GitHub</a>
      </footer>
    </div>
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
    <div class="card">
      <h1>開発者向け</h1>
      <p class="tagline"><router-link to="/">← 一般向け画面に戻る</router-link></p>

      <analysis-panel :dev="true"></analysis-panel>

      <section class="section">
        <h3>テスト評価</h3>
        <p class="muted">固定ブラインドベンチマーク（b1）はここには表示しません（npm run bench で集計のみ）。
          形態素解析: {{ morph.status === "ready" ? "有効" : "無効（文字列モード）" }}</p>
        <button v-for="(s, key) in testsets" :key="key" class="primary" @click="runEvaluation(key)">
          テスト評価（{{ s.name }}）
        </button>
      </section>

      <div v-if="evaluation" class="stats">
        <p>📊 評価結果: {{ testsets[evaluationSet].name }}（{{ evaluation.total }}件）</p>
        <p class="headline">Macro-F1: {{ pct(evaluation.macroF1) }}</p>
        <p>Accuracy: {{ pct(evaluation.accuracy) }}</p>

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
    </div>
  `,
  data() {
    return { evaluation: null, evaluationSet: "", testsets: TESTSETS, testsetData: {}, labels: LABELS, morph };
  },
  methods: {
    display: displayLabel,
    pct(x) {
      return (x * 100).toFixed(1) + "%";
    },
    async runEvaluation(key) {
      const config = await loadConfig();
      if (!this.testsetData[key]) {
        const res = await fetch(TESTSETS[key].path);
        this.testsetData[key] = await res.json();
      }
      this.evaluationSet = key;
      this.evaluation = evaluate(this.testsetData[key], config, { tokenizer: activeTokenizer() });
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

const app = Vue.createApp({});
app.use(router);
app.mount("#app");
