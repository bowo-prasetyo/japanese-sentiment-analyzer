// まとめて分析: 複数のレビューを1件ずつ分析し、全体を集計する（DOM に依存しない。Node のテストで検証する）
//
// エンジンは1件のレビューを分析するためのもの。ページ全体を1つの文として渡すと、
//   - 最初の逆接（けど・のに など）より前がすべて捨てられる
//   - 同じ語は何件のレビューに出ても1回しか数えない
// ため、必ずレビューごとに分けてから分析する。
import { ASPECT_GROUP } from "./breakdown.js";

export const BULK_LIMITS = { maxReviews: 1000 };

// ===== 入力を1件ずつに分ける =====
// mode: "auto"（空行があれば空行で、なければ1行ずつ）/ "lines"（1行に1件）/ "paragraphs"（空行で区切る）
export function splitReviews(text, mode = "auto") {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n");
  const useParagraphs = mode === "paragraphs" || (mode === "auto" && /\n[ \t　]*\n/.test(normalized.trim()));
  const pieces = useParagraphs
    ? normalized.split(/\n[ \t　]*\n+/).map((p) => p.split("\n").map(stripListMarker).join(""))
    : normalized.split("\n").map(stripListMarker);
  return pieces.map((p) => p.trim()).filter(Boolean);
}

// 実際に使った区切り方（"auto" を解決したもの）
export function resolveSplitMode(text, mode = "auto") {
  if (mode !== "auto") return mode;
  return /\n[ \t　]*\n/.test(String(text ?? "").replace(/\r\n?/g, "\n").trim()) ? "paragraphs" : "lines";
}

// 行頭の箇条書きの印（・ - * • 1. 1) ① など）を取る。「3回使って」のような数字は残す
export function stripListMarker(line) {
  return String(line).replace(/^[ \t　]*(?:[・\-*•●○◆■▪︎]|\d{1,3}[.)．）]|[①-⑳])[ \t　]*/, "");
}

// ===== ファイルの読み込み =====
// UTF-8 として読めなければ Shift_JIS（Excel で保存した日本語の CSV に多い）として読む
export function decodeText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("shift_jis").decode(bytes), encoding: "Shift_JIS" };
  }
}

// CSV（RFC 4180: "..." の中のカンマ・改行・"" に対応）を、行（文字列の配列）の配列にする
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const s = String(text ?? "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const REVIEW_HEADER = /レビュー|口コミ|クチコミ|本文|内容|コメント|感想|評価文|review|comment|text|body/i;

// レビューの列を選ぶ。見出しの名前で見つからなければ、文字数の平均が最も長い列
export function pickReviewColumn(rows) {
  if (!rows.length) return { column: 0, hasHeader: false, headers: [] };
  const width = Math.max(...rows.map((r) => r.length));
  const first = rows[0];
  const byName = first.findIndex((h) => REVIEW_HEADER.test(h.trim()) && h.trim().length <= 20);
  // 見出しの行: 名前が一致する、または1行目のどの欄も2行目以降の平均より短い
  const avg = (col, from) => {
    const vals = rows.slice(from).map((r) => (r[col] ?? "").trim().length);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const hasHeader = byName !== -1 || (rows.length > 1 && first.every((h, i) => h.trim().length < avg(i, 1)));
  const headers = Array.from({ length: width }, (_, i) => (hasHeader ? first[i]?.trim() : "") || `${i + 1}列目`);
  if (byName !== -1) return { column: byName, hasHeader: true, headers };
  let column = 0, best = -1;
  for (let i = 0; i < width; i++) {
    const a = avg(i, hasHeader ? 1 : 0);
    if (a > best) { best = a; column = i; }
  }
  return { column, hasHeader, headers };
}

// CSV の指定した列を、レビューの一覧にする
export function reviewsFromCsv(rows, column, hasHeader) {
  return rows.slice(hasHeader ? 1 : 0).map((r) => (r[column] ?? "").replace(/\s*\n\s*/g, "").trim()).filter(Boolean);
}

// 上限を超えた分は切り捨て、その数を返す
export function limitReviews(reviews) {
  return { reviews: reviews.slice(0, BULK_LIMITS.maxReviews), dropped: Math.max(0, reviews.length - BULK_LIMITS.maxReviews) };
}

// ===== 集計 =====
// 1件の結果の区分: "positive" / "negative" / "neutral" / "abstain"（判定できません）
export const verdictOf = (r) => (r.abstained ? "abstain" : r.result);

// items: [{ text, r }]（r は analyzeText の戻り値）
export function summarize(items, groups) {
  const counts = { positive: 0, negative: 0, neutral: 0, abstain: 0 };
  const aspectNames = new Set(groups?.[ASPECT_GROUP] ?? []);
  const aspects = new Map();       // 観点 → { positive: 件数, negative: 件数 }
  const words = { positive: new Map(), negative: new Map() };   // 語 → 出てきたレビューの件数

  for (const { r } of items) {
    counts[verdictOf(r)]++;
    for (const [category, score] of Object.entries(r.categoryScore ?? {})) {
      if (!aspectNames.has(category) || Math.abs(score) < 1e-9) continue;
      const a = aspects.get(category) ?? { category, positive: 0, negative: 0 };
      a[score > 0 ? "positive" : "negative"]++;
      aspects.set(category, a);
    }
    const seen = { positive: new Set(), negative: new Set() };
    for (const m of r.matchedWords ?? []) {
      if (m.polarity === 0) continue;
      seen[m.polarity > 0 ? "positive" : "negative"].add(m.word);
    }
    for (const side of ["positive", "negative"]) {
      for (const w of seen[side]) words[side].set(w, (words[side].get(w) ?? 0) + 1);
    }
  }

  const total = items.length;
  const decided = total - counts.abstain;
  const top = (map) => [...map].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ja")).slice(0, 10);
  return {
    total,
    counts,
    decided,
    // 判定できた件のうち、ポジティブ・ネガティブの割合（判定できません は分母に入れない）
    positiveShare: decided ? counts.positive / decided : 0,
    negativeShare: decided ? counts.negative / decided : 0,
    aspects: [...aspects.values()].sort((a, b) => (b.positive + b.negative) - (a.positive + a.negative) || a.category.localeCompare(b.category, "ja")),
    topWords: { positive: top(words.positive), negative: top(words.negative) }
  };
}

// 絞り込み: verdict（"all" または区分）と aspect（"" または観点。その観点に良い・悪いの評価があるレビュー）
export function filterItems(items, { verdict = "all", aspect = "", side = "" } = {}) {
  return items.filter(({ r }) => {
    if (verdict !== "all" && verdictOf(r) !== verdict) return false;
    if (!aspect) return true;
    const score = r.categoryScore?.[aspect] ?? 0;
    if (side === "positive") return score > 0;
    if (side === "negative") return score < 0;
    return Math.abs(score) > 1e-9;
  });
}

// ===== 書き出し（CSV） =====
const VERDICT_TEXT = { positive: "ポジティブ", negative: "ネガティブ", neutral: "中立", abstain: "判定できません" };

const csvField = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Excel で文字化けしないよう、先頭に BOM を付ける
export function resultsToCsv(items, groups) {
  const aspectNames = new Set(groups?.[ASPECT_GROUP] ?? []);
  const header = ["番号", "レビュー", "判定", "判定スコア", "良かった観点", "悪かった観点", "根拠の語"];
  const lines = items.map(({ text, r }, i) => {
    const aspectsBy = (sign) => Object.entries(r.categoryScore ?? {})
      .filter(([c, s]) => aspectNames.has(c) && Math.sign(s) === sign).map(([c]) => c).join("・");
    const evidence = (r.matchedWords ?? []).filter((m) => m.polarity !== 0)
      .map((m) => `${m.word}(${m.polarity > 0 ? "+" : ""}${m.polarity.toFixed(2)})`).join(" ");
    return [i + 1, text, VERDICT_TEXT[verdictOf(r)], r.abstained ? "" : r.normalizedScore.toFixed(2), aspectsBy(1), aspectsBy(-1), evidence];
  });
  return "﻿" + [header, ...lines].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
