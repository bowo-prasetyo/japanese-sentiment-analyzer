export function analyzeText(text, config) {
  let score = 0;
  let hits = 0;

  let matchedWords = [];
  let categoryScore = {};

  for (let category in config.words) {
    for (let word of config.words[category]) {
      let index = text.indexOf(word);
      if (index === -1) continue;

      let basePolarity = config.polarity[category] || 0;
      let polarity = basePolarity;

      // ===== 否定チェック =====
      const after = text.slice(index + word.length, index + word.length + 6);
      const isNegated = config.negations.some(n => after.startsWith(n));

      if (isNegated) {
        polarity *= -1;
      }

      // ===== 強調チェック =====
      const before = text.slice(Math.max(0, index - 6), index);
      let multiplier = 1;

      for (let key in config.intensifiers) {
        if (before.includes(key)) {
          multiplier = config.intensifiers[key];
          break;
        }
      }

      polarity *= multiplier;

      // ===== 集計 =====
      score += polarity;
      hits++;

      matchedWords.push({
        word,
        category,
        base: basePolarity,
        polarity,
        negated: isNegated,
        multiplier
      });

      categoryScore[category] = (categoryScore[category] || 0) + polarity;
    }
  }

  let result = "中立";

  if (hits === 0) result = "判定不能";
  else if (score > 0) result = "ポジティブ";
  else if (score < 0) result = "ネガティブ";

  return { result, score, hits, matchedWords, categoryScore };
}
