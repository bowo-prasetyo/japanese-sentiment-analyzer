import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText, findMatch, cutAtBoundary } from "../engine/analyzer.js";

const config = JSON.parse(
  readFileSync(new URL("../data/config.json", import.meta.url), "utf8")
);

const words = (r) => r.matchedWords.map((m) => m.word);

test("「神」は「精神」「神経」の内側ではヒットしない", () => {
  assert.ok(!words(analyzeText("精神的に参った", config)).includes("神"));
  assert.ok(!words(analyzeText("神経をすり減らしている", config)).includes("神"));
});

test("「神」単独の用法はヒットする", () => {
  const r = analyzeText("この漫画は神", config);
  assert.ok(words(r).includes("神"));
  assert.equal(r.result, "positive");
});

test("findMatch は除外複合語の外にある出現を見つける", () => {
  assert.equal(findMatch("精神的に神", "神", ["精神"]), 4);
  assert.equal(findMatch("精神", "神", ["精神"]), -1);
});

test("て形の撥音「ん」を否定とみなさない", () => {
  const r = analyzeText("沈み込んでしまって動けない", config);
  const m = r.matchedWords.find((x) => x.word === "沈み込");
  assert.equal(m.negated, false);
  assert.ok(m.polarity < 0);
});

test("否定スコープはリスト順ではなく最も近い境界で切る", () => {
  assert.equal(cutAtBoundary("んでしまって", ["て", "で"]), "ん");
});

test("「〜ではない」の否定を検出する", () => {
  const r = analyzeText("この店は最悪ではない", config);
  assert.equal(r.matchedWords[0].negated, true);
  assert.notEqual(r.result, "negative");
});

test("「〜ではありません」の否定を検出する", () => {
  const r = analyzeText("最悪ではありません", config);
  assert.equal(r.matchedWords[0].negated, true);
});

test("「〜ていない」の否定を検出する", () => {
  const r = analyzeText("全然怒っていない", config);
  assert.equal(r.matchedWords[0].negated, true);
  assert.notEqual(r.result, "negative");
});

test("「嬉しいわけではない」はポジティブにならない", () => {
  assert.notEqual(analyzeText("嬉しいわけではない", config).result, "positive");
});

test("て形の後の別述語の否定は前の語に波及しない", () => {
  const r = analyzeText("悲しくて泣けない", config);
  const m = r.matchedWords.find((x) => x.word.startsWith("悲し"));
  assert.equal(m.negated, false);
});

test("判定は返却される normalizedScore と threshold に一致する", () => {
  for (const text of ["嬉しい", "嬉しい楽しい", "悲しい", "とても嬉しいが悲しい", "今日は晴れ"]) {
    const r = analyzeText(text, config);
    const expected =
      r.hits === 0 ? "neutral"
      : r.normalizedScore >= r.threshold ? "positive"
      : r.normalizedScore <= -r.threshold ? "negative"
      : "neutral";
    assert.equal(r.result, expected, text);
  }
});

// ===== 最長一致 =====

test("長い語の内側にある短い語は数えない（期待外れ ⊃ 期待）", () => {
  const r = analyzeText("期待外れだった", config);
  assert.deepEqual(words(r), ["期待外れ"]);
  assert.equal(r.result, "negative");
});

test("最長一致: 神対応 は 神 ではなく 神対応 としてヒットする", () => {
  assert.deepEqual(words(analyzeText("神対応でした", config)), ["神対応"]);
});

test("短い語でも、長い語の外にある別の出現は数える", () => {
  const r = analyzeText("期待外れだったが、次に期待", config);
  assert.deepEqual(words(r), ["期待外れ", "期待"]);
});

test("同じ箇所に同じ語が複数カテゴリで登録されていても二重に数えない", () => {
  // 「心細」は 悲しみ と 不安 の両方に登録されている
  assert.equal(analyzeText("心細い", config).hits, 1);
});

test("ヒット単語は文中の出現順に並ぶ", () => {
  const r = analyzeText("悲しいけど嬉しい、でも怖い", { ...config, splitters: [] });
  const idx = r.matchedWords.map((m) => "悲しいけど嬉しい、でも怖い".indexOf(m.word));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

// ===== しきい値 =====

test("しきい値ちょうどの単語1つでも判定できる（±0.5 以上で判定）", () => {
  assert.equal(analyzeText("微妙", config).result, "negative");   // -0.5
  assert.equal(analyzeText("安い", config).result, "positive");   // +0.5
});

// ===== レビュー語彙 =====

const cases = {
  positive: ["このパスタは本当に美味しかった", "スタッフが親切だった", "使いやすいアプリ", "コスパがいい", "おすすめです", "全く飽きない"],
  negative: ["届いてすぐ壊れた", "期待外れだった", "店員が無愛想", "使いにくい", "割高だと思う", "二度と行かない", "がっかりした", "イライラする", "うまくいかず落ち込んだ"],
  neutral: ["最低限の荷物で出かけた", "大丈夫です", "祖母の面倒を見る", "失礼します", "友達が見にくる", "いいえ、違います"]
};

for (const [label, texts] of Object.entries(cases)) {
  for (const text of texts) {
    test(`レビュー語彙: 「${text}」→ ${label}`, () => {
      assert.equal(analyzeText(text, config).result, label);
    });
  }
}

test("否定はレビュー語彙にも効く", () => {
  assert.equal(analyzeText("美味しくない", config).result, "negative");
  assert.equal(analyzeText("使いにくくはない", config).matchedWords[0].negated, true);
});

// ===== 否定されたときだけ数える語（negatedPolarity） =====

test("否定された期待動詞はネガティブになる", () => {
  for (const text of ["暑くて眠れなかった", "エアコンが効かず困った", "全く休めなかった", "電源が入らなくなった", "ネットにつながらない"]) {
    const r = analyzeText(text, config);
    assert.equal(r.result, "negative", text);
  }
});

test("肯定形の期待動詞はヒットに数えない", () => {
  const r = analyzeText("ぐっすり眠れた", config);
  assert.equal(r.hits, 0);
  assert.equal(r.result, "neutral");
});

test("肯定形の期待動詞は他の語のスコアを薄めない", () => {
  const withVerb = analyzeText("美味しくて、ぐっすり眠れた", config);
  const without = analyzeText("美味しくて、ぐっすりした", config);
  assert.equal(withVerb.hits, 1);
  assert.equal(withVerb.normalizedScore, without.normalizedScore);
});

test("ヒット情報に negatedOnly と否定時の極性が入る", () => {
  const m = analyzeText("眠れなかった", config).matchedWords[0];
  assert.equal(m.word, "眠れ");
  assert.equal(m.negatedOnly, true);
  assert.equal(m.negated, true);
  assert.equal(m.base, 0);
  assert.equal(m.polarity, config.negatedPolarity["眠れ"]);
});

test("否定された期待動詞にも強調語が効く", () => {
  const m = analyzeText("とても使えない", config).matchedWords[0];
  assert.equal(m.multiplier, 1.5);
  assert.equal(m.polarity, config.negatedPolarity["使え"] * 1.5);
});

test("否定の例外（〜しかない など）では数えない", () => {
  assert.equal(analyzeText("休めしかない", { ...config, negationExceptions: ["しかない"] }).hits, 0);
});

test("通常の語の否定反転は従来どおり", () => {
  const m = analyzeText("嬉しくない", config).matchedWords[0];
  assert.equal(m.negatedOnly, undefined);
  assert.equal(m.polarity, -1);
});
