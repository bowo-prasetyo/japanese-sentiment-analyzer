// エンジンの出力ラベル（英語）→ 画面表示（日本語）と CSS クラスの対応
export const LABEL_DISPLAY = {
  positive: { text: "ポジティブ", cssClass: "positive" },
  negative: { text: "ネガティブ", cssClass: "negative" },
  neutral:  { text: "中立",       cssClass: "neutral" }
};

// 辞書の語が見つからず判定できなかったとき（中立とは区別して表示する）
export const ABSTAIN_DISPLAY = { text: "判定できません", cssClass: "abstain" };

export function displayLabel(label) {
  return LABEL_DISPLAY[label] ?? LABEL_DISPLAY.neutral;
}

// 分析結果（analyzeText の戻り値）から表示を決める
export function displayResult(r) {
  return r?.abstained ? ABSTAIN_DISPLAY : displayLabel(r?.result);
}

// 「判定できません」の理由（画面の説明文を選ぶ）。判定できたときは null。
//   contrast   … 逆接（けど・のに など）の後半に評価の語がなく、前半の語は後半を優先するため数えなかった
//   notCounted … 語は見つかったが、条件・説明・用法のため、すべて数えなかった
//   zeroOnly   … 見つかった語が、ポジティブにもネガティブにも働かない語（極性 0）だけだった
//   noWords    … 辞書の語が1つも見つからなかった
export function abstainExplanation(r) {
  if (!r?.abstained) return null;
  const skipped = r.skippedWords ?? [];
  const contrast = skipped.filter((s) => s.reason === "contrast");
  if (r.contrastMarker && contrast.length) {
    return { kind: "contrast", marker: r.contrastMarker, words: contrast.map((s) => s.word) };
  }
  if (skipped.length) return { kind: "notCounted", words: skipped.map((s) => s.word) };
  if (r.matchedWords?.length) return { kind: "zeroOnly", words: r.matchedWords.map((m) => m.word) };
  return { kind: "noWords", words: [] };
}

// 「数えなかった語」の理由の表示
export const SKIP_REASONS = { condition: "条件", description: "説明", usage: "用法", contrast: "逆接" };

export function skipReasonText(s) {
  if (s.reason === "contrast") return `逆接「${s.marker}」より前。後半を優先`;
  return `${SKIP_REASONS[s.reason] ?? s.reason}「${s.marker}」`;
}

// 入力が空（空白・改行だけを含む）か
export function isBlankInput(text) {
  return !text || !text.trim();
}
