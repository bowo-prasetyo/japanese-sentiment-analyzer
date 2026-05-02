import { analyzeText } from "./analyzer.js";  

export function evaluate(testset, config) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  let total = testset.length;

  let results = [];

  let errorCases = [];   // ❗追加
  let noHitCases = [];   // ❗追加

  for (let item of testset) {
    const r = analyzeText(item.text, config);
    const predicted = r.result;

    let correct = predicted === item.label;

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

    // ❗ ミスだけ抽出
    if (!correct) {
      errorCases.push(detail);
    }

    // ❗ ヒットなし（辞書不足）
    if (r.hits === 0) {
      noHitCases.push(detail);
    }

    // confusion matrix
    if (item.label === "positive") {
      if (predicted === "positive") tp++;
      else fn++;
    }

    if (item.label === "negative") {
      if (predicted === "negative") tn++;
      else fp++;
    }
  }

  let accuracy = (tp + tn) / total;
  let precision = tp / (tp + fp || 1);
  let recall = tp / (tp + fn || 1);

  return {
    accuracy,
    precision,
    recall,
    confusion: { tp, tn, fp, fn },
    results,

    // ❗追加
    errorCases,
    noHitCases
  };
}
