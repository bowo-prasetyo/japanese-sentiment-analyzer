const DEFAULT_BOUNDARIES = ["て", "で", "、", "。", ",", "."];
const DEFAULT_NEGATION_WINDOW = 8;
const DEFAULT_THRESHOLD = 0.5;

// 位置 index から長さ len の一致が、除外複合語（例: 「神」に対する「精神」）の内側にあるか
function isInsideExcludedCompound(text, index, len, compounds) {
  for (const c of compounds) {
    let p = text.indexOf(c);
    while (p !== -1) {
      if (p <= index && index + len <= p + c.length) return true;
      p = text.indexOf(c, p + 1);
    }
  }
  return false;
}

// 位置 index から長さ len の一致が、すでに採用された一致の内側にあるか
function isInsideTakenSpan(index, len, taken) {
  return taken.some((t) => t.start <= index && index + len <= t.end);
}

// 除外複合語の内側にも、採用済みの一致（より長い語）の内側にもない、
// 最初の出現位置を返す（なければ -1）
export function findMatch(text, word, exclusions = [], taken = []) {
  let from = 0;
  while (true) {
    const index = text.indexOf(word, from);
    if (index === -1) return -1;
    if (
      !isInsideExcludedCompound(text, index, word.length, exclusions) &&
      !isInsideTakenSpan(index, word.length, taken)
    ) {
      return index;
    }
    from = index + 1;
  }
}

// 最長一致: 長い語から順に探し、すでに採用した語の内側にある短い語は数えない
// （例: 「期待外れ」がヒットしたら、その中の「期待」は数えない）。
// 戻り値は文中の出現順。
export function findMatches(text, config) {
  const candidates = [];
  for (const category in config.words) {
    for (const word of config.words[category]) {
      candidates.push({ word, category });
    }
  }
  // Array.prototype.sort は安定ソートなので、同じ長さなら辞書の順序を保つ
  candidates.sort((a, b) => b.word.length - a.word.length);

  const taken = [];
  const matches = [];
  for (const { word, category } of candidates) {
    const exclusions = config.wordExclusions?.[word] || [];
    const index = findMatch(text, word, exclusions, taken);
    if (index === -1) continue;
    taken.push({ start: index, end: index + word.length });
    matches.push({ word, category, index });
  }

  return matches.sort((a, b) => a.index - b.index);
}

// 否定スコープを、最も近い境界で切る。
// ただし境界の直後が「ではな」「ていな」のような否定へのブリッジなら切らない。
export function cutAtBoundary(after, boundaries, bridges = []) {
  for (let i = 0; i < after.length; i++) {
    const isBoundary = boundaries.some((b) => after.startsWith(b, i));
    if (!isBoundary) continue;

    const isBridge = bridges.some((br) => after.startsWith(br, i));
    if (!isBridge) return after.slice(0, i);
  }
  return after;
}

export function analyzeText(text, config) {

  for (let s of config.splitters) {
    if (text.includes(s)) {
      const parts = text.split(s);

      if (parts.length >= 2) {
        const after = parts.slice(1).join(s); // 複数対策
        const afterResult = analyzeText(after, config);

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

  const TH = config.threshold ?? DEFAULT_THRESHOLD;
  const boundaries = config.negationBoundaries || DEFAULT_BOUNDARIES;
  const bridges = config.negationBridges || [];
  const windowSize = config.negationWindow ?? DEFAULT_NEGATION_WINDOW;

  for (const { word, category, index } of findMatches(text, config)) {
    let basePolarity =
      config.wordPolarity?.[word] ??
      config.polarity[category] ??
      0;
    let polarity = basePolarity;

    // ===== 接続語でスコープを切る（最も近い境界） =====
    const afterFull = text.slice(index + word.length);
    let after = cutAtBoundary(afterFull, boundaries, bridges);

    // 念のため長さ制限（暴走防止）
    after = after.slice(0, windowSize);

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

  // 判定に使うのはこの正規化スコア（UIにもこれを表示する）
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
  else if (normalizedScore >= TH) {
    result = "positive";
  }
  else if (normalizedScore <= -TH) {
    result = "negative";
  }
  else {
    result = "neutral";
  }

  return {
    result,
    score,
    normalizedScore,
    threshold: TH,
    hits,
    matchedWords,
    categoryScore,
    debugLabel
  };
}
