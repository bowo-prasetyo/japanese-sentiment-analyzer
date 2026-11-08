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
