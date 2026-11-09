// ユーザー辞書: 閲覧者が自分の分野の語を追加する（ブラウザに保存・JSON で書き出し／読み込み）
// このモジュールは DOM に依存しない（Node のテストで検証する）
import { analyzeText } from "../engine/analyzer.js";

export const USER_CATEGORY = "ユーザー辞書";
export const FORMAT_VERSION = 1;
export const LIMITS = { maxEntries: 200, maxWordLength: 20, minPolarity: -1.5, maxPolarity: 1.5 };

// 1件を検証する。問題があればエラーメッセージ（日本語）の配列を返す
export function validateEntry(entry, categories) {
  const errors = [];
  const word = typeof entry?.word === "string" ? entry.word.trim() : "";
  if (!word) errors.push("語を入力してください");
  else if (/\s/.test(word)) errors.push("語に空白は使えません");
  else if (word.length > LIMITS.maxWordLength) errors.push(`語は${LIMITS.maxWordLength}文字以内にしてください`);

  const p = entry?.polarity;
  if (typeof p !== "number" || !Number.isFinite(p)) errors.push("極性は数値で指定してください");
  else if (p === 0) errors.push("極性 0 の語は判定に影響しません");
  else if (p < LIMITS.minPolarity || p > LIMITS.maxPolarity) {
    errors.push(`極性は ${LIMITS.minPolarity} 〜 ${LIMITS.maxPolarity} にしてください`);
  }

  if (!categories.includes(entry?.category)) errors.push("カテゴリが正しくありません");
  return errors;
}

// 注意（エラーではない）: 1文字の語は他の語の一部として誤ってヒットしやすい
export function warningsFor(entry) {
  const word = entry?.word?.trim() ?? "";
  const warnings = [];
  if (word.length === 1) warnings.push("1文字の語は、他の語の一部として誤ってヒットしやすくなります");
  if (isNegatedForm(word)) warnings.push(NEGATION_ADVICE);
  return warnings;
}

export const NEGATION_ADVICE =
  "否定（〜ない）は自動で判定されます。ふつうは肯定の形で登録してください（例:「美味しくない」ではなく「美味し」を＋で登録）。" +
  "「つまらない」のように、それ自体が一つの語のときは、このままで構いません";

// ===== 登録する語の形の助言 =====
// エンジンは語を文字列として探すため、「コシがある」で登録すると「コシがあった」「コシがあって」に一致しない。
// 活用で変わらない部分（語幹）を候補として示す。自動では書き換えない（閲覧者が選ぶ）。

// 否定の形（否定はエンジンが自動で判定するため、通常は肯定の形で登録する）
const NEGATED_ENDING = /(ない|なかった|なくて|ません|ませんでした)$/;
// 文末の丁寧語・断定（取り除いてから語幹を探す）
const COPULA_ENDINGS = ["ませんでした", "でした", "だった", "ました", "です", "ます", "だ"];
// 「する」の活用（丁寧語より先に取る: リピートします → リピート）
const SURU_ENDINGS = ["しました", "しません", "します", "した", "して", "する"];
// 語尾の候補（上から順に試し、残りが2文字以上になる最初のものを使う）
const STEM_ENDINGS = [
  ...SURU_ENDINGS,                                // 満足する → 満足
  "かった", "くて", "く",                         // 美味しかった → 美味し
  "った", "って", "んだ", "んで", "いた", "いて", "いだ", "いで", "た", "て" // あった → あ、食べた → 食べ
];
// 「い」を取らない語: 形容詞ではない語（「い」を取ると別の語に一致してしまう）と、
// 活用が不規則な「いい」（いい → よかった）
const NOT_I_ADJECTIVES = ["きれい", "キレイ", "嫌い", "大嫌い", "いい"];

const stripEnding = (word, endings) => {
  for (const e of endings) {
    if (word.endsWith(e) && word.length - e.length >= 2) return word.slice(0, -e.length);
  }
  return word;
};

// 否定の形か（例: 美味しくない・使えなかった）
export function isNegatedForm(word) {
  return NEGATED_ENDING.test(word?.trim() ?? "");
}

// 活用で変わらない部分の候補。同じ・2文字未満・否定の形のときは null
export function suggestStem(word) {
  const original = word?.trim() ?? "";
  let w = original.replace(/[。、．，！!？?]+$/, "");
  if (isNegatedForm(w)) return null;
  const withoutSuru = stripEnding(w, SURU_ENDINGS);
  if (withoutSuru !== w) return withoutSuru !== original ? withoutSuru : null;
  w = stripEnding(w, COPULA_ENDINGS);

  const afterEnding = stripEnding(w, STEM_ENDINGS);
  if (afterEnding !== w) {
    w = afterEnding;
  } else if (/い$/.test(w) && !NOT_I_ADJECTIVES.some((n) => w.endsWith(n)) && w.length >= 3) {
    w = w.slice(0, -1);                    // 形容詞: 美味しい → 美味し
  } else if (/[うくぐすつぬぶむる]$/.test(w) && w.length >= 3 && !/^(.+)\1$/.test(w)) {
    w = w.slice(0, -1);                    // 動詞: コシがある → コシがあ（「ぷるぷる」のような繰り返しの語は除く）
  }
  return w !== original && w.length >= 2 ? w : null;
}

// ===== 入力中の文で、その語がどう扱われるか（追加する前に確かめる） =====
// 戻り値の status:
//   counted  … 判定に使われる（polarity: この文での値、negated: 否定されたか）
//   skipped  … 見つかるが数えない（reason・marker は analyzeText の skippedWords と同じ）
//   covered  … 文中にあるが、より長い辞書の語の一部として扱われ、使われない（by: その語）
//   absent   … この文には含まれない
// 文が空、または語が空のときは null
export function previewEntry(entry, text, config, entries = [], options = {}) {
  const word = entry?.word?.trim();
  if (!word || !text?.trim() || !config) return null;
  if (!text.includes(word)) return { status: "absent" };

  const p = entry.polarity;
  const polarity = typeof p === "number" && Number.isFinite(p) && p !== 0 ? p : 1;
  const candidate = { word, polarity, category: entry.category ?? USER_CATEGORY };
  const others = (entries ?? []).filter((e) => e.word !== word);
  const r = analyzeText(text, mergeUserDictionary(config, [...others, candidate]), options);

  const m = r.matchedWords.find((x) => x.word === word);
  if (m) return { status: "counted", polarity: m.polarity, negated: m.negated };
  const s = r.skippedWords.find((x) => x.word === word);
  if (s) return { status: "skipped", reason: s.reason, marker: s.marker };
  const longer = [...r.matchedWords, ...r.skippedWords].find((x) => x.word.length > word.length && x.word.includes(word));
  return { status: "covered", by: longer?.word ?? null };
}

// 追加先に選べるカテゴリ: レビュー観点 ＋ ユーザー辞書
export function selectableCategories(config) {
  return [...(config.groups?.["レビュー観点"] ?? []), USER_CATEGORY];
}

// 組み込み辞書にユーザー辞書を重ねた設定を返す（元の config は変更しない）。
// 同じ語が組み込み辞書にあれば、ユーザーの指定（カテゴリ・極性）で置き換える。
export function mergeUserDictionary(config, entries) {
  if (!entries?.length) return config;
  const userWords = new Set(entries.map((e) => e.word));

  const words = {};
  for (const [category, list] of Object.entries(config.words)) {
    words[category] = list.filter((w) => !userWords.has(w));
  }
  const without = (obj) =>
    Object.fromEntries(Object.entries(obj ?? {}).filter(([w]) => !userWords.has(w)));

  const merged = {
    ...config,
    words,
    polarity: { ...config.polarity, [USER_CATEGORY]: 0 },
    wordPolarity: { ...config.wordPolarity },
    // ユーザーが極性を決めた語には、組み込みの特別ルール（否定時だけ数える・後続文字の条件）を適用しない
    negatedPolarity: without(config.negatedPolarity),
    followedBy: without(config.followedBy),
    negationWindowOverrides: without(config.negationWindowOverrides)
  };

  for (const { word, polarity, category } of entries) {
    (merged.words[category] ??= []).push(word);
    merged.wordPolarity[word] = polarity;
  }
  return merged;
}

// 追加（同じ語があれば置き換え）。新しい配列を返す
export function upsertEntry(entries, entry) {
  const clean = { word: entry.word.trim(), polarity: entry.polarity, category: entry.category };
  const rest = entries.filter((e) => e.word !== clean.word);
  if (rest.length >= LIMITS.maxEntries) throw new Error(`ユーザー辞書は${LIMITS.maxEntries}語までです`);
  return [...rest, clean];
}

export function removeEntry(entries, word) {
  return entries.filter((e) => e.word !== word);
}

// 書き出し・読み込み（JSON）
export function serialize(entries) {
  return JSON.stringify({ format: "japanese-sentiment-analyzer/user-dictionary", version: FORMAT_VERSION, entries }, null, 2);
}

// 読み込み: 正しい語だけを取り込み、取り込めなかった件数も返す
export function parseImport(text, categories) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON として読み込めませんでした");
  }
  const list = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(list)) throw new Error("entries（語の一覧）が見つかりませんでした");

  const entries = [];
  let rejected = 0;
  for (const e of list) {
    if (validateEntry(e, categories).length) { rejected++; continue; }
    entries.push({ word: e.word.trim(), polarity: e.polarity, category: e.category });
  }
  // 同じ語は後のものを優先し、上限で切る
  const dedup = [...new Map(entries.map((e) => [e.word, e])).values()];
  const kept = dedup.slice(0, LIMITS.maxEntries);
  return { entries: kept, rejected: rejected + (entries.length - kept.length) };
}

// ブラウザ保存（読み書きできない環境でも動くように try/catch）
export const STORAGE_KEY = "userDictionary";

export function loadEntries(storage, categories) {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return text ? parseImport(text, categories).entries : [];
  } catch {
    return [];
  }
}

export function saveEntries(storage, entries) {
  try {
    storage?.setItem(STORAGE_KEY, serialize(entries));
    return true;
  } catch {
    return false;
  }
}
