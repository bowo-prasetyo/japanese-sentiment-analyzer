// カテゴリ別スコアを「レビュー観点」と「感情・評価」に分け、影響の大きい順に並べる
export const ASPECT_GROUP = "レビュー観点";

export function splitCategoryScores(categoryScore, groups) {
  const aspects = new Set(groups?.[ASPECT_GROUP] ?? []);
  const toList = (keep) =>
    Object.entries(categoryScore ?? {})
      .filter(([category, score]) => keep(category) && Math.abs(score) > 1e-9)
      .map(([category, score]) => ({ category, score }))
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return {
    aspects: toList((c) => aspects.has(c)),
    emotions: toList((c) => !aspects.has(c))
  };
}

// +1.00 / −0.80 のように符号付きで表示する（マイナスは全角ではなく U+2212）
export function formatScore(score) {
  const s = Math.abs(score).toFixed(2);
  return score > 0 ? `+${s}` : score < 0 ? `−${s}` : s;
}

export function scoreClass(score) {
  return score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
}
