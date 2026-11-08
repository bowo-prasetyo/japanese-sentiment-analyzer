import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../engine/evaluator.js";

// 最小の辞書: 「良」→ positive、「悪」→ negative、それ以外は neutral
const config = {
  splitters: [],
  negations: [],
  intensifiers: {},
  polarity: { pos: 1, neg: -1 },
  words: { pos: ["良"], neg: ["悪"] }
};

const testset = [
  { text: "良", label: "positive" },  // 正解
  { text: "良", label: "positive" },  // 正解
  { text: "x", label: "positive" },   // positive → neutral
  { text: "悪", label: "negative" },  // 正解
  { text: "良", label: "negative" },  // negative → positive
  { text: "x", label: "neutral" },    // 正解
  { text: "悪", label: "neutral" }    // neutral → negative
];

test("3クラスの混同行列を正しく数える", () => {
  const e = evaluate(testset, config);
  assert.deepEqual(e.confusion, {
    positive: { positive: 2, negative: 0, neutral: 1 },
    negative: { positive: 1, negative: 1, neutral: 0 },
    neutral:  { positive: 0, negative: 1, neutral: 1 }
  });
});

test("neutral の正解も accuracy に数える", () => {
  const e = evaluate(testset, config);
  assert.equal(e.accuracy, 4 / 7);
});

test("クラス別 precision / recall / F1 と macro-F1", () => {
  const e = evaluate(testset, config);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

  close(e.perClass.positive.precision, 2 / 3);
  close(e.perClass.positive.recall, 2 / 3);
  close(e.perClass.negative.precision, 1 / 2);
  close(e.perClass.negative.recall, 1 / 2);
  close(e.perClass.neutral.precision, 1 / 2);
  close(e.perClass.neutral.recall, 1 / 2);
  close(e.macroF1, (2 / 3 + 1 / 2 + 1 / 2) / 3);
});

test("予測ゼロのクラスはゼロ除算せず 0 になる", () => {
  const e = evaluate([{ text: "x", label: "positive" }], config);
  assert.equal(e.perClass.positive.precision, 0);
  assert.equal(e.perClass.negative.f1, 0);
  assert.ok(Number.isFinite(e.macroF1));
});

test("不明なラベルは集計から除外して報告する", () => {
  const e = evaluate([{ text: "良", label: "ポジティブ" }], config);
  assert.equal(e.total, 0);
  assert.equal(e.skipped.length, 1);
});
