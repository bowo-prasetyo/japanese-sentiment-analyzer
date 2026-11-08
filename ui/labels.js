// エンジンの出力ラベル（英語）→ 画面表示（日本語）と CSS クラスの対応
export const LABEL_DISPLAY = {
  positive: { text: "ポジティブ", cssClass: "positive" },
  negative: { text: "ネガティブ", cssClass: "negative" },
  neutral:  { text: "中立",       cssClass: "neutral" }
};

export function displayLabel(label) {
  return LABEL_DISPLAY[label] ?? LABEL_DISPLAY.neutral;
}
