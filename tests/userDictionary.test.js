import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";
import {
  USER_CATEGORY, LIMITS, validateEntry, warningsFor, selectableCategories, mergeUserDictionary,
  upsertEntry, removeEntry, serialize, parseImport, loadEntries, saveEntries
} from "../ui/userDictionary.js";

const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
const categories = selectableCategories(config);

test("選べるカテゴリはレビュー観点 ＋ ユーザー辞書", () => {
  assert.ok(categories.includes("味"));
  assert.equal(categories.at(-1), USER_CATEGORY);
});

test("validateEntry: 正しい語は通り、誤りは日本語のメッセージで返す", () => {
  assert.deepEqual(validateEntry({ word: "コシがあ", polarity: 0.8, category: "味" }, categories), []);
  assert.ok(validateEntry({ word: "", polarity: 1, category: "味" }, categories).length);
  assert.ok(validateEntry({ word: "空 白", polarity: 1, category: "味" }, categories).length);
  assert.ok(validateEntry({ word: "あ".repeat(LIMITS.maxWordLength + 1), polarity: 1, category: "味" }, categories).length);
  assert.ok(validateEntry({ word: "語", polarity: 0, category: "味" }, categories).length);
  assert.ok(validateEntry({ word: "語", polarity: 2, category: "味" }, categories).length);
  assert.ok(validateEntry({ word: "語", polarity: "1", category: "味" }, categories).length);
  assert.ok(validateEntry({ word: "語", polarity: 1, category: "存在しない" }, categories).length);
});

test("1文字の語には注意を出す（エラーではない）", () => {
  assert.equal(warningsFor({ word: "神" }).length, 1);
  assert.equal(warningsFor({ word: "神対応" }).length, 0);
});

test("ユーザー辞書の語で判定できるようになる（判定できません → ポジティブ）", () => {
  const text = "麺のコシがあって最後まで楽しめた一杯";
  const before = analyzeText("麺のコシがあった", config);
  assert.equal(before.abstained, true);
  const merged = mergeUserDictionary(config, [{ word: "コシがあ", polarity: 0.8, category: "味" }]);
  const after = analyzeText("麺のコシがあった", merged);
  assert.equal(after.abstained, false);
  assert.equal(after.result, "positive");
  assert.equal(after.matchedWords[0].category, "味");
  assert.ok(analyzeText(text, merged).matchedWords.some((m) => m.word === "コシがあ"));
});

test("ユーザー辞書の語にも否定・強調が効く", () => {
  const merged = mergeUserDictionary(config, [{ word: "コシがあ", polarity: 0.8, category: "味" }]);
  const r = analyzeText("とてもコシがあって良かった", merged);
  assert.equal(r.matchedWords.find((m) => m.word === "コシがあ").multiplier, 1.5);
  const neg = analyzeText("全然コシがない", mergeUserDictionary(config, [{ word: "コシが", polarity: 0.8, category: "味" }]));
  assert.equal(neg.matchedWords[0].negated, true);
  assert.equal(neg.result, "negative");
});

test("組み込みの語と同じ語は、ユーザーの指定で置き換える（二重に数えない）", () => {
  const merged = mergeUserDictionary(config, [{ word: "微妙", polarity: 0.6, category: USER_CATEGORY }]);
  const r = analyzeText("微妙な味わい", merged);
  assert.deepEqual(r.matchedWords.map((m) => [m.word, m.category, m.polarity]), [["微妙", USER_CATEGORY, 0.6]]);
});

test("組み込みの特別ルール（否定時だけ数える語）は、ユーザーが上書きした語には適用しない", () => {
  const merged = mergeUserDictionary(config, [{ word: "眠れ", polarity: 0.7, category: USER_CATEGORY }]);
  assert.ok(!("眠れ" in merged.negatedPolarity));
  assert.equal(analyzeText("ぐっすり眠れる部屋", merged).hits >= 1, true);
});

test("元の config は変更しない", () => {
  const before = JSON.stringify(config);
  mergeUserDictionary(config, [{ word: "微妙", polarity: 0.6, category: "味" }]);
  assert.equal(JSON.stringify(config), before);
  assert.equal(mergeUserDictionary(config, []), config);
});

test("upsert は同じ語を置き換え、remove は削除する", () => {
  let e = upsertEntry([], { word: " コシがあ ", polarity: 0.8, category: "味" });
  e = upsertEntry(e, { word: "コシがあ", polarity: 1, category: "味" });
  assert.deepEqual(e, [{ word: "コシがあ", polarity: 1, category: "味" }]);
  assert.deepEqual(removeEntry(e, "コシがあ"), []);
});

test("上限を超える追加はエラー", () => {
  const full = Array.from({ length: LIMITS.maxEntries }, (_, i) => ({ word: `語${i}`, polarity: 1, category: "味" }));
  assert.throws(() => upsertEntry(full, { word: "新しい語", polarity: 1, category: "味" }));
  assert.doesNotThrow(() => upsertEntry(full, { word: "語0", polarity: -1, category: "味" })); // 置き換えは可
});

test("書き出した JSON を読み込むと元に戻る", () => {
  const entries = [{ word: "コシがあ", polarity: 0.8, category: "味" }, { word: "伸びやす", polarity: -0.6, category: "品質" }];
  assert.deepEqual(parseImport(serialize(entries), categories), { entries, rejected: 0 });
});

test("読み込み: 不正な語は除き、件数を返す。壊れた JSON はエラー", () => {
  const text = JSON.stringify({ entries: [
    { word: "良い語", polarity: 1, category: "味" },
    { word: "", polarity: 1, category: "味" },
    { word: "悪い", polarity: 9, category: "味" }
  ] });
  assert.deepEqual(parseImport(text, categories), { entries: [{ word: "良い語", polarity: 1, category: "味" }], rejected: 2 });
  assert.throws(() => parseImport("{", categories), /JSON/);
  assert.throws(() => parseImport("{}", categories), /entries/);
});

test("ブラウザ保存: 読み書きできない環境でも例外を出さない", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadEntries(broken, categories), []);
  assert.equal(saveEntries(broken, []), false);
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const entries = [{ word: "コシがあ", polarity: 0.8, category: "味" }];
  assert.equal(saveEntries(storage, entries), true);
  assert.deepEqual(loadEntries(storage, categories), entries);
});
