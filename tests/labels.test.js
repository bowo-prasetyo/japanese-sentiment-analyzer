import { test } from "node:test";
import assert from "node:assert/strict";
import { displayLabel } from "../ui/labels.js";

test("エンジンの英語ラベルが正しい表示と色クラスに対応する", () => {
  assert.deepEqual(displayLabel("positive"), { text: "ポジティブ", cssClass: "positive" });
  assert.deepEqual(displayLabel("negative"), { text: "ネガティブ", cssClass: "negative" });
  assert.deepEqual(displayLabel("neutral"), { text: "中立", cssClass: "neutral" });
});

test("未知のラベルは中立扱い", () => {
  assert.equal(displayLabel(undefined).cssClass, "neutral");
});

test("判定できなかった結果は「判定できません」と表示する", async () => {
  const { displayResult } = await import("../ui/labels.js");
  assert.deepEqual(displayResult({ result: "neutral", abstained: true }), { text: "判定できません", cssClass: "abstain" });
  assert.equal(displayResult({ result: "neutral", abstained: false }).text, "中立");
  assert.equal(displayResult({ result: "positive", abstained: false }).text, "ポジティブ");
});
