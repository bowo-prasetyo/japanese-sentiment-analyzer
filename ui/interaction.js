// 画面操作の判定（DOM に依存しない。Node のテストで検証する）

// Ctrl+Enter（Mac は ⌘+Enter）で分析する。日本語入力の変換中（Enter で確定するとき）は分析しない
export function isAnalyzeShortcut(event) {
  if (!event || event.key !== "Enter") return false;
  if (event.isComposing || event.keyCode === 229) return false;
  return Boolean(event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
}

// ショートカットの表示（Mac・iPad は ⌘、それ以外は Ctrl）
export function shortcutLabel(platform = "") {
  return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘+Enter" : "Ctrl+Enter";
}

// 分析した結果が画面の下の方（または画面の外）にあれば、結果までスクロールする。
// 結果の上端が画面の上から 60% より下、または画面の上より外にあるとき true
export function needsScrollToResult(top, viewportHeight) {
  if (!Number.isFinite(top) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return false;
  return top < 0 || top > viewportHeight * 0.6;
}
