import { test } from "node:test";
import assert from "node:assert/strict";
import { isAnalyzeShortcut, shortcutLabel, needsScrollToResult } from "../ui/interaction.js";

test("isAnalyzeShortcut: Ctrl+Enter / ⌘+Enter で分析する", () => {
  assert.equal(isAnalyzeShortcut({ key: "Enter", ctrlKey: true }), true);
  assert.equal(isAnalyzeShortcut({ key: "Enter", metaKey: true }), true);
});

test("isAnalyzeShortcut: Enter だけ・Shift などとの組み合わせ・他のキーでは分析しない", () => {
  assert.equal(isAnalyzeShortcut({ key: "Enter" }), false);
  assert.equal(isAnalyzeShortcut({ key: "Enter", ctrlKey: true, shiftKey: true }), false);
  assert.equal(isAnalyzeShortcut({ key: "Enter", metaKey: true, altKey: true }), false);
  assert.equal(isAnalyzeShortcut({ key: "a", ctrlKey: true }), false);
  assert.equal(isAnalyzeShortcut(null), false);
});

test("isAnalyzeShortcut: 日本語入力の変換中は分析しない", () => {
  assert.equal(isAnalyzeShortcut({ key: "Enter", ctrlKey: true, isComposing: true }), false);
  assert.equal(isAnalyzeShortcut({ key: "Enter", ctrlKey: true, keyCode: 229 }), false);
});

test("shortcutLabel: Mac・iPad は ⌘、それ以外は Ctrl", () => {
  assert.equal(shortcutLabel("MacIntel"), "⌘+Enter");
  assert.equal(shortcutLabel("macOS"), "⌘+Enter");
  assert.equal(shortcutLabel("iPad"), "⌘+Enter");
  assert.equal(shortcutLabel("Win32"), "Ctrl+Enter");
  assert.equal(shortcutLabel("Linux x86_64"), "Ctrl+Enter");
  assert.equal(shortcutLabel(undefined), "Ctrl+Enter");
});

test("needsScrollToResult: 結果が画面の下の方・画面の外のときだけスクロールする", () => {
  assert.equal(needsScrollToResult(557, 664), true);   // スマホ: 判定の帯だけが見える
  assert.equal(needsScrollToResult(900, 664), true);   // 画面の外（下）
  assert.equal(needsScrollToResult(-40, 664), true);   // 画面の外（上）
  assert.equal(needsScrollToResult(503, 900), false);  // デスクトップ: 十分に見えている
  assert.equal(needsScrollToResult(NaN, 900), false);
  assert.equal(needsScrollToResult(100, 0), false);
});
