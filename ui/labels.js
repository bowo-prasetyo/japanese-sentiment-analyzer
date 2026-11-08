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
