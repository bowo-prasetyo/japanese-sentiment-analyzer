import { analyzeText } from "./analyzer.js";

// 3クラス分類（positive / negative / neutral）として評価する
export const LABELS = ["positive", "negative", "neutral"];

function emptyMatrix() {
  const m = {};
  for (const gold of LABELS) {
    m[gold] = {};
    for (const pred of LABELS) m[gold][pred] = 0;
  }
  return m;
}

// ゼロ除算は 0 とする（scikit-learn の zero_division=0 と同じ扱い）
function safeDiv(a, b) {
  return b === 0 ? 0 : a / b;
}

export function evaluate(testset, config) {
  // confusion[正解][予測] = 件数
  const confusion = emptyMatrix();

  const results = [];
  const errorCases = [];
  const noHitCases = [];
  const skipped = []; // ラベルが不正なデータ

  for (const item of testset) {
    if (!LABELS.includes(item.label)) {
      skipped.push(item);
      continue;
    }

    const r = analyzeText(item.text, config);
    const predicted = r.result;
    const correct = predicted === item.label;

    const detail = {
      text: item.text,
      label: item.label,
      predicted,
      score: r.score,
      normalizedScore: r.normalizedScore,
      hits: r.hits,
      matchedWords: r.matchedWords,
      correct
    };

    results.push(detail);
    confusion[item.label][predicted]++;

    if (!correct) errorCases.push(detail);
    if (r.hits === 0) noHitCases.push(detail); // 辞書不足の目安
  }

  const total = results.length;
  const correctCount = LABELS.reduce((s, l) => s + confusion[l][l], 0);

  const perClass = {};
  for (const label of LABELS) {
    const tp = confusion[label][label];
    const predictedAs = LABELS.reduce((s, g) => s + confusion[g][label], 0);
    const support = LABELS.reduce((s, p) => s + confusion[label][p], 0);

    const precision = safeDiv(tp, predictedAs);
    const recall = safeDiv(tp, support);
    const f1 = safeDiv(2 * precision * recall, precision + recall);

    perClass[label] = { precision, recall, f1, support };
  }

  const macroF1 =
    LABELS.reduce((s, l) => s + perClass[l].f1, 0) / LABELS.length;

  return {
    total,
    accuracy: safeDiv(correctCount, total),
    macroF1, // ← 代表指標
    perClass,
    confusion,
    results,
    errorCases,
    noHitCases,
    skipped
  };
}
