export function analyzeText(text, config) {
  let score = 0;
  let hits = 0;

  let matchedWords = [];

  let categoryScore = {};

  for (let category in config.words) {
    for (let word of config.words[category]) {
      if (text.includes(word)) {
        const p = config.polarity[category] || 0;

        score += p;
        hits++;

        matchedWords.push({
          word: word,
          category: category,
          polarity: p
        });

        // ★カテゴリスコア集計
        categoryScore[category] = (categoryScore[category] || 0) + p;
      }
    }
  }

  let result = "中立";

  if (hits === 0) result = "判定不能";
  else if (score > 0) result = "ポジティブ";
  else if (score < 0) result = "ネガティブ";

  return { result, score, hits, matchedWords, categoryScore };
}
