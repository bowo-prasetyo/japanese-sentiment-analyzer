export function analyzeText(text, config) {
  let score = 0;
  let hits = 0;

  let matchedWords = [];
  let categoryScore = {};

  const TH = 0.5; // ← しきい値（まずは0.5推奨）

  for (let category in config.words) {
    for (let word of config.words[category]) {
      let index = text.indexOf(word);
      if (index === -1) continue;

      let basePolarity = config.polarity[category] || 0;
      let polarity = basePolarity;

      // ===== 否定チェック =====
      const after = text.slice(index + word.length, index + word.length + 6);
      const isNegated = config.negations.some(n => after.includes(n));

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
  
  let normalizedScore = 0;

  if (hits > 0) {
    normalizedScore = score / Math.sqrt(hits);
  } 
  
  let result = "neutral";
  let debugLabel = "neutral";
 
  if (hits === 0) {
    result = "neutral";
    debugLabel = "no_hit";
  }
  else if (normalizedScore > TH) {
    result = "positive";
  }
  else if (normalizedScore < -TH) {
    result = "negative";
  }
  else {
    result = "neutral";
  }
  
  return {
    result,
    score,
    normalizedScore,
    hits,
    matchedWords,
    categoryScore,
    debugLabel
  };  
}
