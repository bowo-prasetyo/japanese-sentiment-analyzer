import { analyzeText } from "./analyzer.js";

export function evaluate(testset, config) {
  let tp = 0; // 正しくpositive
  let tn = 0; // 正しくnegative
  let fp = 0; // positiveと誤判定
  let fn = 0; // negativeと誤判定

  let total = testset.length;

  let results = [];

  for (let item of testset) {
    const r = analyzeText(item.text, config);
    const predicted = r.result;

    let correct = predicted === item.label;

    results.push({
      text: item.text,
      label: item.label,
      predicted,
      score: r.score,
      correct
    });

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
    results
  };
}
