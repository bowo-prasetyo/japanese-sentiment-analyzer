// 結果の見せ方（DOM に依存しない。Node のテストで検証する）
import { formatScore } from "./breakdown.js";
import { skipReasonText } from "./labels.js";

// ===== 文中の語に印を付ける =====
// 分析した文（text）を、印のない部分と、辞書の語の部分に分ける。
// kind: "positive" / "negative"（判定に使った値の符号。否定のあとの値）、"zero"（極性 0）、"skipped"（数えなかった語）
// 位置（index）が文と合わない語・ほかの語と重なる語は、印を付けない（念のため）
export function highlightSegments(text, r) {
  if (!text) return [];
  const marks = [
    ...(r?.matchedWords ?? []).map((m) => ({
      index: m.index, word: m.word,
      kind: m.polarity > 0 ? "positive" : m.polarity < 0 ? "negative" : "zero",
      title: `${m.word}: ${m.negated || m.negatedOnly ? "否定 → " : ""}${formatScore(m.polarity)}`
    })),
    ...(r?.skippedWords ?? []).map((s) => ({
      index: s.index, word: s.word, kind: "skipped",
      title: `${s.word}: 数えなかった（${skipReasonText(s)}）`
    }))
  ]
    .filter((m) => Number.isInteger(m.index) && text.startsWith(m.word, m.index))
    .sort((a, b) => a.index - b.index);

  const segments = [];
  let pos = 0;
  for (const m of marks) {
    if (m.index < pos) continue;   // 重なり
    if (m.index > pos) segments.push({ text: text.slice(pos, m.index), kind: null });
    segments.push({ text: m.word, kind: m.kind, title: m.title });
    pos = m.index + m.word.length;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), kind: null });
  return segments;
}

// ===== 判定スコアのメーター =====
// −range 〜 +range の目盛りの上での位置（0〜100%）。範囲の外は端に置き、clamped で知らせる。
// zone: 判定と同じ区分（しきい値ちょうどはポジティブ／ネガティブ。エンジンと同じ）
export const METER_RANGE = 2;

export function meterPosition(score, threshold, range = METER_RANGE) {
  const s = Number.isFinite(score) ? score : 0;
  const clampedScore = Math.max(-range, Math.min(range, s));
  const toPercent = (v) => ((v + range) / (2 * range)) * 100;
  return {
    percent: toPercent(clampedScore),
    clamped: clampedScore !== s,
    zone: s >= threshold ? "positive" : s <= -threshold ? "negative" : "neutral",
    negativeEnd: toPercent(-threshold),   // ここより左がネガティブ
    positiveStart: toPercent(threshold)   // ここより右がポジティブ
  };
}

const ZONE_TEXT = { positive: "ポジティブ", negative: "ネガティブ", neutral: "中立" };

// メーターの読み上げ（role="img" の aria-label）
export function meterLabel(score, threshold) {
  const { zone } = meterPosition(score, threshold);
  const t = threshold.toFixed(1);
  const range = zone === "positive" ? `+${t} 以上` : zone === "negative" ? `−${t} 以下` : `−${t} より大きく +${t} より小さい`;
  return `判定スコア ${formatScore(score)}。${ZONE_TEXT[zone]}の範囲（${range}）`;
}
