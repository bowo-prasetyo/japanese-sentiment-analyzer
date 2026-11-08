// ユーザー辞書: 閲覧者が自分の分野の語を追加する（ブラウザに保存・JSON で書き出し／読み込み）
// このモジュールは DOM に依存しない（Node のテストで検証する）

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
  return entry?.word?.trim().length === 1 ? ["1文字の語は、他の語の一部として誤ってヒットしやすくなります"] : [];
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
