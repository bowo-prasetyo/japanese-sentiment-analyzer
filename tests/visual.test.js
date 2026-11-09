import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";
import { highlightSegments, meterPosition, meterLabel, METER_RANGE } from "../ui/visual.js";

const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
const segs = (text) => highlightSegments(text, analyzeText(text, config)).map((s) => [s.text, s.kind]);

// ===== エンジン: 語の位置（index） =====

test("matchedWords・skippedWords の index は、元の文の中の位置を指す", () => {
  for (const text of [
    "麺がもちもちで美味しく、店員さんも親切だった",
    "見た目は最悪だけど、味は美味しい",
    "最高だけど高いのに、満足",          // 逆接が2つ（入れ子）
    "動かない場合は、販売店にご連絡ください",
    "美味しくない。二度と買わない"
  ]) {
    const r = analyzeText(text, config);
    for (const w of [...r.matchedWords, ...r.skippedWords]) {
      assert.equal(text.slice(w.index, w.index + w.word.length), w.word, `${text}: ${w.word} @ ${w.index}`);
    }
  }
});

// ===== 文中の語に印を付ける =====

test("highlightSegments: 判定に使った語・数えなかった語に印を付け、文をそのまま並べる", () => {
  assert.deepEqual(segs("見た目は最悪だけど、味は美味しい"), [
    ["見た目は", null], ["最悪", "skipped"], ["だけど、味は", null], ["美味し", "positive"], ["い", null]
  ]);
});

test("highlightSegments: 否定された語は、否定のあとの値で色を決める", () => {
  assert.deepEqual(segs("美味しくない"), [["美味し", "negative"], ["くない", null]]);
});

test("highlightSegments: 印を付けた部分をつなぐと、元の文に戻る", () => {
  for (const text of ["麺がもちもちで美味しく、店員さんも親切だった", "最高だけど高いのに、満足", "今日は火曜日です"]) {
    assert.equal(segs(text).map(([t]) => t).join(""), text);
  }
});

test("highlightSegments: 説明（title）に値と否定、数えなかった理由を入れる", () => {
  const r = analyzeText("美味しくない", config);
  assert.equal(highlightSegments("美味しくない", r)[0].title, "美味し: 否定 → −1.00");
  const r2 = analyzeText("動かない場合は、販売店にご連絡ください", config);
  assert.match(highlightSegments("動かない場合は、販売店にご連絡ください", r2)[0].title, /数えなかった（条件「場合/);
});

test("highlightSegments: 位置が文と合わない語・重なる語には印を付けない（入力が変わった場合など）", () => {
  const r = { matchedWords: [{ word: "最高", index: 0, polarity: 1 }, { word: "高", index: 1, polarity: 1 }], skippedWords: [] };
  assert.deepEqual(highlightSegments("最高です", r).map((s) => [s.text, s.kind]), [["最高", "positive"], ["です", null]]);
  assert.deepEqual(highlightSegments("別の文です", r).map((s) => [s.text, s.kind]), [["別の文です", null]]);
  assert.deepEqual(highlightSegments("", r), []);
});

// ===== メーター =====

test("meterPosition: −2〜+2 の目盛り上の位置としきい値の位置", () => {
  const m = meterPosition(0, 0.5);
  assert.equal(m.percent, 50);
  assert.equal(m.negativeEnd, 37.5);
  assert.equal(m.positiveStart, 62.5);
  assert.equal(meterPosition(1, 0.5).percent, 75);
  assert.equal(meterPosition(-2, 0.5).percent, 0);
});

test("meterPosition: 範囲の外は端に置き、clamped で知らせる", () => {
  assert.deepEqual([meterPosition(3.2, 0.5).percent, meterPosition(3.2, 0.5).clamped], [100, true]);
  assert.deepEqual([meterPosition(-9, 0.5).percent, meterPosition(-9, 0.5).clamped], [0, true]);
  assert.equal(meterPosition(METER_RANGE, 0.5).clamped, false);
});

test("meterPosition: 区分はエンジンと同じ（しきい値ちょうどはポジティブ／ネガティブ）", () => {
  assert.equal(meterPosition(0.5, 0.5).zone, "positive");
  assert.equal(meterPosition(-0.5, 0.5).zone, "negative");
  assert.equal(meterPosition(0.49, 0.5).zone, "neutral");
  for (const text of ["最高でした", "最悪でした", "麺がもちもちで美味しく、店員さんも親切だった"]) {
    const r = analyzeText(text, config);
    assert.equal(meterPosition(r.normalizedScore, r.threshold).zone, r.result, text);
  }
});

test("meterLabel: 読み上げ用に、値と範囲を言葉にする", () => {
  assert.equal(meterLabel(1.33, 0.5), "判定スコア +1.33。ポジティブの範囲（+0.5 以上）");
  assert.equal(meterLabel(-0.8, 0.5), "判定スコア −0.80。ネガティブの範囲（−0.5 以下）");
  assert.equal(meterLabel(0.2, 0.5), "判定スコア +0.20。中立の範囲（−0.5 より大きく +0.5 より小さい）");
});
