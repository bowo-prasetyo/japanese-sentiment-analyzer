export function analyzeText(text, config) {

  for (let s of config.splitters) {
    if (text.includes(s)) {
      const parts = text.split(s);

      if (parts.length >= 2) {
        const before = parts[0];
        const after = parts.slice(1).join(s); // 複数対策

        const beforeResult = analyzeText(before, config);
        const afterResult  = analyzeText(after, config);

        // 👉 後半を優先（ここがポイント）
        return {
          ...afterResult,
          debugLabel: "contrast_override"
        };
      }
    }
  }

  // ===== 通常処理 =====
  let score = 0;
  let hits = 0;

  let matchedWords = [];
  let categoryScore = {};

  const TH = 0.5; // ← しきい値（まずは0.5推奨）

  for (let category in config.words) {
    for (let word of config.words[category]) {
      let index = text.indexOf(word);
      if (index === -1) continue;

      let basePolarity =
        config.wordPolarity?.[word] ??
        config.polarity[category] ??
        0;
      let polarity = basePolarity;
      
      const after = text.slice(index + word.length, index + word.length + 6);
      
      // ===== 改善（リリーフ）チェック =====
      const reliefWords = config.relievers || [];
      const isRelieved = reliefWords.some(r => after.includes(r));
      
      if (isRelieved && basePolarity < 0) {
        // ネガティブが解消 → ポジティブに反転（または弱める）
        polarity = Math.abs(basePolarity) * 0.7;
      }
      
      // ❗ 例外チェック
      const isException = config.negationExceptions?.some(e => after.includes(e));
      
      // ===== 否定チェック =====      
      const isNegated =
        !isException &&
        config.negations.some(n => after.includes(n));

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
