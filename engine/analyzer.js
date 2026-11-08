const DEFAULT_BOUNDARIES = ["て", "で", "、", "。", ",", "."];
const DEFAULT_NEGATION_WINDOW = 8;
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_HYPOTHETICAL_WINDOW = 12;
const DEFAULT_HYPOTHETICAL_BOUNDARIES = ["、", "。", ",", "."];

// 最初の句読点まで（句読点を含む）、最大 maxLength 文字を返す
export function scopeUntilPunctuation(text, boundaries, maxLength) {
  let end = text.length;
  for (const b of boundaries) {
    const i = text.indexOf(b);
    if (i !== -1 && i + 1 < end) end = i + 1;
  }
  return text.slice(0, Math.min(end, maxLength));
}

// 語の後ろ（同じ節の中）に条件・説明の目印があれば、その種類と目印を返す
export function findHypotheticalMarker(scope, config) {
  const kinds = [
    ["condition", config.conditionMarkers],
    ["description", config.descriptionMarkers]
  ];
  for (const [reason, markers] of kinds) {
    const marker = (markers || []).find((m) => scope.includes(m));
    if (marker) return { reason, marker };
  }
  return null;
}

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
  const hypotheticalWindow = config.hypotheticalWindow ?? DEFAULT_HYPOTHETICAL_WINDOW;
  const markerBoundaries = config.hypotheticalBoundaries || DEFAULT_HYPOTHETICAL_BOUNDARIES;
  const skippedWords = [];

  const found = findMatches(text, config);
  const overlapsOther = (cur) =>
    found.some((o) => o !== cur && o.index < cur.index + cur.word.length && cur.index < o.index + o.word.length);

  for (const match of found) {
    const { word, category, index } = match;
    // 否定されたときだけ数える語（例:「眠れ」「効か」）。
    // 肯定形（眠れた・効く）は期待どおりの結果なので、ヒットに数えない。
    const negatedOnlyPolarity = config.negatedPolarity?.[word];
    const isNegatedOnly = negatedOnlyPolarity !== undefined;

    let basePolarity = isNegatedOnly
      ? 0
      : config.wordPolarity?.[word] ??
        config.polarity[category] ??
        0;
    let polarity = basePolarity;

    // ===== 接続語でスコープを切る（最も近い境界） =====
    const afterFull = text.slice(index + word.length);
    const clause = cutAtBoundary(afterFull, boundaries, bridges);

    // ===== 用法のチェック（followedBy） =====
    // 例:「よく」は直後が「な」「て」のとき（よくない・よくなった・よくて）だけ
    // 形容詞「良く」として数え、副詞（よく壊れる・よくある・よく似た）は数えない。
    const followers = config.followedBy?.[word];
    if (followers && !followers.some((f) => afterFull.startsWith(f))) {
      // 「ほどよく」の「よく」のように別の語と重なる場合は、除外一覧にも出さない
      if (!overlapsOther(match)) {
        skippedWords.push({ word, category, reason: "usage", marker: followers.join("・") });
      }
      continue;
    }

    // ===== 条件・説明のチェック =====
    // 「動かない場合は〜」「壊れた場合は〜」（条件）や
    // 「眠れない夜のための〜」「眠れない人向けの〜」（対象の説明）は、
    // 書き手の体験ではないので、否定の有無にかかわらずその語を数えない。
    // 目印は、否定スコープ（て・で でも切る）とは別に、句読点までを見る。
    //   - 「壊れていた場合、」の「て」や「使えない場合でも」の「で」で切らないため
    //   - 句読点そのものも含める（「最悪の場合、」の判定に必要）
    const markerScope = scopeUntilPunctuation(afterFull, markerBoundaries, hypotheticalWindow);
    const skipReason = findHypotheticalMarker(markerScope, config);
    if (skipReason) {
      skippedWords.push({ word, category, ...skipReason });
      continue;
    }

    // 念のため長さ制限（暴走防止）
    let after = clause.slice(0, windowSize);

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

    if (isNegatedOnly) {
      if (!isNegated) continue; // 肯定形 → 数えない（スコアを薄めない）
      polarity = negatedOnlyPolarity;
    }
    else if (isNegated) {
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
      multiplier,
      ...(isNegatedOnly && { negatedOnly: true, negatedPolarity: negatedOnlyPolarity })
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
    skippedWords,
    categoryScore,
    debugLabel
  };
}
