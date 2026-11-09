import { test } from "node:test";
import assert from "node:assert/strict";
import { displayLabel, abstainExplanation, skipReasonText, isBlankInput } from "../ui/labels.js";

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

// ===== 「判定できません」の理由（画面の説明文） =====

test("abstainExplanation: 判定できたときは null", () => {
  assert.equal(abstainExplanation(null), null);
  assert.equal(abstainExplanation({ abstained: false, matchedWords: [{ word: "最高" }], skippedWords: [] }), null);
});

test("abstainExplanation: 語が1つもない → noWords", () => {
  assert.deepEqual(abstainExplanation({ abstained: true, matchedWords: [], skippedWords: [] }), { kind: "noWords", words: [] });
});

test("abstainExplanation: 逆接の前の語だけ → contrast（「見つかりませんでした」とは言わない）", () => {
  const r = {
    abstained: true, contrastMarker: "けど", matchedWords: [],
    skippedWords: [{ word: "最高", reason: "contrast", marker: "けど" }, { word: "使いやすい", reason: "contrast", marker: "けど" }]
  };
  assert.deepEqual(abstainExplanation(r), { kind: "contrast", marker: "けど", words: ["最高", "使いやすい"] });
});

test("abstainExplanation: 条件・説明・用法で数えなかった語だけ → notCounted", () => {
  const r = { abstained: true, matchedWords: [], skippedWords: [{ word: "動か", reason: "condition", marker: "場合は" }] };
  assert.deepEqual(abstainExplanation(r), { kind: "notCounted", words: ["動か"] });
});

test("abstainExplanation: 極性 0 の語だけ → zeroOnly", () => {
  const r = { abstained: true, matchedWords: [{ word: "驚い", polarity: 0 }], skippedWords: [] };
  assert.deepEqual(abstainExplanation(r), { kind: "zeroOnly", words: ["驚い"] });
});

test("skipReasonText: 理由と目印を表示する", () => {
  assert.equal(skipReasonText({ reason: "condition", marker: "場合は" }), "条件「場合は」");
  assert.equal(skipReasonText({ reason: "usage", marker: "な・て" }), "用法「な・て」");
  assert.equal(skipReasonText({ reason: "contrast", marker: "けど" }), "逆接「けど」より前。後半を優先");
});

test("isBlankInput: 空・空白・改行だけは空とみなす", () => {
  for (const t of ["", "   ", "\n\t", "　", undefined, null]) assert.equal(isBlankInput(t), true, JSON.stringify(t));
  assert.equal(isBlankInput(" 最高 "), false);
});
