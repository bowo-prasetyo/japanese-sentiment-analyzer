import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";
import {
  BULK_LIMITS, splitReviews, resolveSplitMode, stripListMarker, decodeText, parseCsv, pickReviewColumn,
  reviewsFromCsv, limitReviews, summarize, filterItems, resultsToCsv, verdictOf
} from "../ui/bulk.js";

const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
const analyzeAll = (reviews) => reviews.map((text) => ({ text, r: analyzeText(text, config) }));

// ===== 1件ずつに分ける =====

test("splitReviews: 空行がなければ1行に1件、空行があれば段落ごとに1件（自動）", () => {
  assert.deepEqual(splitReviews("美味しい\n\n高い\n"), ["美味しい", "高い"]);
  assert.deepEqual(splitReviews("美味しい\n高い"), ["美味しい", "高い"]);
  assert.deepEqual(splitReviews("麺が美味しい。\nスープも良い。\n\n店員が無愛想。\n"), ["麺が美味しい。スープも良い。", "店員が無愛想。"]);
  assert.equal(resolveSplitMode("a\n\nb"), "paragraphs");
  assert.equal(resolveSplitMode("a\nb"), "lines");
});

test("splitReviews: 指定した区切り方を使い、Windows の改行・空白だけの行も扱う", () => {
  assert.deepEqual(splitReviews("a\r\nb\r\n\r\nc", "lines"), ["a", "b", "c"]);
  assert.deepEqual(splitReviews("a\nb", "paragraphs"), ["ab"]);
  assert.deepEqual(splitReviews("a\n　\nb"), ["a", "b"]);
  assert.deepEqual(splitReviews(""), []);
});

test("stripListMarker: 箇条書きの印は取り、文の中身の数字は残す", () => {
  assert.equal(stripListMarker("・美味しい"), "美味しい");
  assert.equal(stripListMarker("1. 美味しい"), "美味しい");
  assert.equal(stripListMarker("12) 高い"), "高い");
  assert.equal(stripListMarker("① 安い"), "安い");
  assert.equal(stripListMarker("- 遅い"), "遅い");
  assert.equal(stripListMarker("3回使って壊れた"), "3回使って壊れた");
  assert.equal(stripListMarker("100点満点"), "100点満点");
});

// ===== ファイル =====

test("decodeText: UTF-8（BOM 付きも）と Shift_JIS を読める", () => {
  const utf8 = new TextEncoder().encode("﻿美味しい");
  assert.deepEqual(decodeText(utf8), { text: "美味しい", encoding: "UTF-8" });
  // 「美味しい」の Shift_JIS
  const sjis = new Uint8Array([0x94, 0xfc, 0x96, 0xa1, 0x82, 0xb5, 0x82, 0xa2]);
  assert.deepEqual(decodeText(sjis), { text: "美味しい", encoding: "Shift_JIS" });
});

test("parseCsv: 引用符の中のカンマ・改行・二重引用符", () => {
  const rows = parseCsv('id,レビュー\r\n1,"美味しい, でも高い"\n2,"店員が""親切""\nまた来たい"\n\n');
  assert.deepEqual(rows, [["id", "レビュー"], ["1", "美味しい, でも高い"], ["2", '店員が"親切"\nまた来たい']]);
});

test("pickReviewColumn: 見出しの名前でレビューの列を選ぶ", () => {
  const rows = parseCsv("日付,評価,口コミ\n2026-01-01,5,とても美味しかった\n2026-01-02,1,二度と行かない");
  assert.deepEqual(pickReviewColumn(rows), { column: 2, hasHeader: true, headers: ["日付", "評価", "口コミ"] });
});

test("pickReviewColumn: 見出しがなければ、平均の文字数が最も長い列", () => {
  const rows = parseCsv("1,5,とても美味しかった\n2,1,二度と行かない店だった");
  const pick = pickReviewColumn(rows);
  assert.equal(pick.column, 2);
  assert.equal(pick.hasHeader, false);
  assert.deepEqual(reviewsFromCsv(rows, pick.column, pick.hasHeader), ["とても美味しかった", "二度と行かない店だった"]);
});

test("reviewsFromCsv: 見出しを除き、欄の中の改行はつなげ、空の欄は除く", () => {
  const rows = [["review"], ["美味しい\nまた来たい"], [""], ["高い"]];
  assert.deepEqual(reviewsFromCsv(rows, 0, true), ["美味しいまた来たい", "高い"]);
});

test("limitReviews: 上限を超えた分は切り捨て、その数を返す", () => {
  const many = Array.from({ length: BULK_LIMITS.maxReviews + 5 }, (_, i) => `r${i}`);
  const { reviews, dropped } = limitReviews(many);
  assert.equal(reviews.length, BULK_LIMITS.maxReviews);
  assert.equal(dropped, 5);
});

// ===== 集計 =====

const sample = [
  "麺がもちもちで美味しく、店員さんも親切だった",
  "スープがぬるくて、店員の態度が悪い",
  "値段のわりに量が少ない",
  "美味しいし安い",
  "今日は火曜日です",
  "駅から徒歩5分の場所にある"
];

test("summarize: 判定の件数と、判定できた件のうちの割合（判定できません は分母に入れない）", () => {
  const s = summarize(analyzeAll(sample), config.groups);
  assert.equal(s.total, 6);
  assert.deepEqual(s.counts, { positive: 2, negative: 2, neutral: 0, abstain: 2 });
  assert.equal(s.decided, 4);
  assert.equal(s.positiveShare, 0.5);
});

test("summarize: 観点ごとに、良かった件数と悪かった件数を数える（レビューの件数）", () => {
  const s = summarize(analyzeAll(sample), config.groups);
  const taste = s.aspects.find((a) => a.category === "味");
  assert.deepEqual([taste.positive, taste.negative], [2, 1]);
  const service = s.aspects.find((a) => a.category === "サービス");
  assert.deepEqual([service.positive, service.negative], [1, 1]);
  // 件数の多い観点から並ぶ
  assert.equal(s.aspects[0].category, "味");
});

test("summarize: よく出た語は、その語が出たレビューの件数で数える（1件の中で何度出ても1）", () => {
  const s = summarize(analyzeAll(["美味しい美味しい", "美味しい", "ぬるい"]), config.groups);
  assert.deepEqual(s.topWords.positive[0], { word: "美味し", count: 2 });
  assert.deepEqual(s.topWords.negative[0], { word: "ぬるい", count: 1 });
});

test("1件ずつ分析するので、あるレビューの逆接が別のレビューを消さない", () => {
  // まとめて1文として分析すると「けど」より前（1件目）が捨てられる
  const reviews = ["とても美味しかった", "安いけど、量が少ない"];
  const s = summarize(analyzeAll(reviews), config.groups);
  assert.equal(s.counts.positive, 1);
  assert.equal(s.counts.negative, 1);
  assert.equal(verdictOf(analyzeText(reviews.join("\n"), config)), "negative");
});

test("filterItems: 判定と観点（良い・悪い）で絞り込む", () => {
  const items = analyzeAll(sample);
  assert.equal(filterItems(items, { verdict: "abstain" }).length, 2);
  assert.equal(filterItems(items, { aspect: "味" }).length, 3);
  assert.equal(filterItems(items, { aspect: "味", side: "negative" }).length, 1);
  assert.equal(filterItems(items, { verdict: "positive", aspect: "サービス" }).length, 1);
});

test("resultsToCsv: BOM 付き、見出しつき、引用符で囲むべき欄は囲む", () => {
  const csv = resultsToCsv(analyzeAll(["美味しい, でも高い", "今日は火曜日です"]), config.groups);
  assert.ok(csv.startsWith("﻿番号,レビュー,判定,判定スコア,良かった観点,悪かった観点,根拠の語\r\n"));
  const rows = parseCsv(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], "美味しい, でも高い");
  assert.equal(rows[2][2], "判定できません");
  assert.equal(rows[2][3], "");
});
