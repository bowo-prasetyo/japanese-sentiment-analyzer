import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitCategoryScores, formatScore, scoreClass } from "../ui/breakdown.js";
import { analyzeText } from "../engine/analyzer.js";

const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));

test("レビュー観点と感情・評価に分け、影響の大きい順に並べる", () => {
  const groups = { "レビュー観点": ["味", "サービス"] };
  const r = splitCategoryScores({ "味": 1, "喜び": 0.5, "サービス": -1.6, "怒り": -1 }, groups);
  assert.deepEqual(r.aspects.map((x) => x.category), ["サービス", "味"]);
  assert.deepEqual(r.emotions.map((x) => x.category), ["怒り", "喜び"]);
});

test("スコア 0 のカテゴリは表示しない", () => {
  const r = splitCategoryScores({ "味": 0, "喜び": 0 }, { "レビュー観点": ["味"] });
  assert.deepEqual(r, { aspects: [], emotions: [] });
});

test("groups がなくても動く（すべて感情・評価として扱う）", () => {
  assert.deepEqual(splitCategoryScores({ "喜び": 1 }, undefined).emotions, [{ category: "喜び", score: 1 }]);
});

test("実際の分析結果で観点が取り出せる", () => {
  const r = analyzeText("麺がもちもちで美味しく、店員さんも親切だった", config);
  const { aspects } = splitCategoryScores(r.categoryScore, config.groups);
  assert.ok(aspects.some((a) => a.category === "味" && a.score > 0));
  assert.ok(aspects.some((a) => a.category === "サービス" && a.score > 0));
});

test("符号付きの表示と色クラス", () => {
  assert.equal(formatScore(1), "+1.00");
  assert.equal(formatScore(-0.8), "−0.80");
  assert.equal(formatScore(0), "0.00");
  assert.equal(scoreClass(0.3), "positive");
  assert.equal(scoreClass(-0.3), "negative");
  assert.equal(scoreClass(0), "neutral");
});
