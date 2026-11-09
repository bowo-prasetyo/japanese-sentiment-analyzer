import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";
import {
  USER_CATEGORY, LIMITS, validateEntry, warningsFor, selectableCategories, mergeUserDictionary,
  upsertEntry, removeEntry, serialize, parseImport, loadEntries, saveEntries,
  suggestStem, isNegatedForm, previewEntry, NEGATION_ADVICE, mergeImported, importMessage
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

// ===== 登録する語の形の助言（活用で変わらない部分の候補） =====

test("suggestStem: 活用する語は、変わらない部分を候補にする", () => {
  const cases = {
    "コシがある": "コシがあ", "コシがあった": "コシがあ", "コシがあって": "コシがあ",
    "美味しい": "美味し", "美味しかった": "美味し", "美味しく": "美味し", "美味しいです": "美味し",
    "使いやすい": "使いやす", "食べた": "食べ", "気に入った": "気に入", "役立つ": "役立", "泣ける": "泣け",
    "満足する": "満足", "満足した": "満足", "リピートします": "リピート", "ホッとする": "ホッと",
    "最悪だ": "最悪", "最悪です": "最悪", "大満足！": "大満足"
  };
  for (const [word, stem] of Object.entries(cases)) assert.equal(suggestStem(word), stem, word);
});

test("suggestStem: 候補を出さない語（すでに語幹・活用しない・短すぎる・不規則・否定）", () => {
  for (const word of ["コシがあ", "美味し", "神対応", "サクサク", "もちもち", "ぷるぷる", "きれい", "嫌い",
                      "香りがいい", "良い", "よく", "書く", "美味しくない", "つまらない", "", "  "]) {
    assert.equal(suggestStem(word), null, word);
  }
});

test("suggestStem の候補は、元の語の活用した形にも一致する", () => {
  const forms = { "コシがある": ["コシがあった", "コシがあって", "コシがあります"], "美味しい": ["美味しかった", "美味しくて", "美味しそう"] };
  for (const [word, texts] of Object.entries(forms)) {
    const stem = suggestStem(word);
    for (const t of texts) {
      assert.ok(t.includes(stem), `${stem} が ${t} に含まれない`);
      assert.ok(!t.includes(word) || t === word, `${word} がそのまま ${t} に一致してしまう（テストの前提が誤り）`);
    }
  }
});

test("isNegatedForm と注意: 否定の形には、肯定の形での登録を勧める", () => {
  assert.equal(isNegatedForm("美味しくない"), true);
  assert.equal(isNegatedForm("使えなかった"), true);
  assert.equal(isNegatedForm("おすすめしません"), true);
  assert.equal(isNegatedForm("美味しい"), false);
  assert.ok(warningsFor({ word: "美味しくない" }).includes(NEGATION_ADVICE));
  assert.ok(!warningsFor({ word: "美味しい" }).includes(NEGATION_ADVICE));
});

// ===== 追加する前に、入力中の文で一致するかを確かめる =====

const preview = (word, text, polarity = 0.8, entries = []) =>
  previewEntry({ word, polarity, category: "味" }, text, config, entries);

test("previewEntry: 判定に使われる（否定も反映）", () => {
  assert.deepEqual(preview("コシがあ", "麺はコシがあって美味しい"), { status: "counted", polarity: 0.8, negated: false });
  assert.deepEqual(preview("コシがあ", "麺にコシがあまりない"), { status: "counted", polarity: -0.8, negated: true });
});

test("previewEntry: 活用した形には一致しない語は absent（「コシがある」と「コシがあって」）", () => {
  assert.deepEqual(preview("コシがある", "麺はコシがあって美味しい"), { status: "absent" });
});

test("previewEntry: 見つかるが数えない語は skipped（逆接の前・条件）", () => {
  assert.deepEqual(preview("コシがあ", "コシがある麺だけど、量が少ない"), { status: "skipped", reason: "contrast", marker: "けど" });
  assert.equal(preview("コシがあ", "コシがあった場合は交換します").reason, "condition");
});

test("previewEntry: より長い辞書の語の内側にある語は covered", () => {
  assert.deepEqual(preview("美味", "とても美味しい"), { status: "covered", by: "美味し" });
});

test("previewEntry: 極性が未入力でも一致は確かめられる。文や語が空なら null", () => {
  assert.equal(preview("コシがあ", "コシがあった", NaN).status, "counted");
  assert.equal(preview("コシがあ", ""), null);
  assert.equal(preview("", "コシがあった"), null);
});

test("previewEntry: 登録済みの同じ語は、入力中の極性で置き換えて確かめる", () => {
  const entries = [{ word: "コシがあ", polarity: -1, category: "味" }];
  assert.equal(preview("コシがあ", "コシがあった", 0.8, entries).polarity, 0.8);
});

// ===== 読み込み（JSON）: 追加・更新・上限を正しく数える =====

const entry = (word, polarity = 1) => ({ word, polarity, category: "味" });

test("mergeImported: 新しい語は追加、登録済みの語は更新として数える", () => {
  const r = mergeImported([entry("既存", 0.5)], [entry("既存", 1), entry("新語")]);
  assert.deepEqual([r.added, r.updated, r.overLimit], [1, 1, 0]);
  assert.deepEqual(r.entries.map((e) => [e.word, e.polarity]), [["既存", 1], ["新語", 1]]);
});

test("mergeImported: 上限を超える新しい語は取り込まず、その数を返す（更新は上限でも行う）", () => {
  const full = Array.from({ length: LIMITS.maxEntries }, (_, i) => entry(`語${i}`));
  const r = mergeImported(full, [entry("語0", -1), entry("新A"), entry("新B")]);
  assert.deepEqual([r.added, r.updated, r.overLimit], [0, 1, 2]);
  assert.equal(r.entries.length, LIMITS.maxEntries);
  assert.equal(r.entries.find((e) => e.word === "語0").polarity, -1);
});

test("importMessage: 実際に取り込んだ数だけを伝える（以前は読み込んだ件数をそのまま表示していた）", () => {
  assert.equal(importMessage({ added: 3, updated: 0, overLimit: 0 }), "3 語を追加しました");
  assert.equal(importMessage({ added: 2, updated: 1, overLimit: 0 }), "2 語を追加・1 語を更新しました");
  assert.equal(
    importMessage({ added: 0, updated: 1, overLimit: 2 }, 1),
    `1 語を更新しました。上限（${LIMITS.maxEntries} 語）のため 2 語は読み込めませんでした。1 件は不正なため除外しました`
  );
  assert.equal(importMessage({ added: 0, updated: 0, overLimit: 0 }), "追加・更新した語はありません");
});

// ===== 削除を元に戻す =====
import { restoreEntry } from "../ui/userDictionary.js";

test("restoreEntry: 削除した語を元の位置に戻す", () => {
  const list = [entry("A"), entry("B"), entry("C")];
  const removed = removeEntry(list, "B");
  assert.deepEqual(restoreEntry(removed, entry("B"), 1).map((e) => e.word), ["A", "B", "C"]);
  assert.deepEqual(restoreEntry(removed, entry("B"), 99).map((e) => e.word), ["A", "C", "B"]);
  assert.deepEqual(restoreEntry(removed, entry("B"), undefined).map((e) => e.word), ["A", "C", "B"]);
});

test("restoreEntry: 同じ語がすでにある・上限に達している ときは戻さない（null）", () => {
  assert.equal(restoreEntry([entry("B")], entry("B"), 0), null);
  const full = Array.from({ length: LIMITS.maxEntries }, (_, i) => entry(`語${i}`));
  assert.equal(restoreEntry(full, entry("B"), 0), null);
  assert.equal(restoreEntry([], null, 0), null);
});
