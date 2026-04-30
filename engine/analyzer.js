export function analyzeText(text, config) {
  let score = 0;
  let hits = 0;

  for (let category in config.words) {
    for (let word of config.words[category]) {
      if (text.includes(word)) {
        score += config.polarity[category] || 0;
        hits++;
      }
    }
  }

  let result = "中立";

  if (hits === 0) result = "判定不能";
  else if (score > 0) result = "ポジティブ";
  else if (score < 0) result = "ネガティブ";

  return { result, score, hits };
}
