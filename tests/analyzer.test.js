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
  const r = analyzeText("神対応でした", config);
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
      : r.normalizedScore > r.threshold ? "positive"
      : r.normalizedScore < -r.threshold ? "negative"
      : "neutral";
    assert.equal(r.result, expected, text);
  }
});
