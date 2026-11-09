import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { externalScripts, vendoredScripts, readIndexHtml, readRepoFile } from "../scripts/cdn-scripts.js";

const html = readIndexHtml();
const vendored = vendoredScripts(html);
const SRI = /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/;

test("Vue と Vue Router は vendor/ から読み込む（CDN に依存しない）", () => {
  const srcs = vendored.map((s) => s.src);
  assert.ok(srcs.some((s) => /^vendor\/vue@\d+\.\d+\.\d+\/vue\.global\.prod\.js$/.test(s)), srcs.join(", "));
  assert.ok(srcs.some((s) => /^vendor\/vue-router@\d+\.\d+\.\d+\/vue-router\.global\.prod\.js$/.test(s)), srcs.join(", "));
  assert.deepEqual(externalScripts(html), [], "index.html が外部の <script> を読み込んでいます");
});

test("vendor/ のスクリプトは integrity を持ち、ファイルのハッシュと一致する", () => {
  for (const { src, integrity, crossorigin } of vendored) {
    assert.match(integrity ?? "", SRI, `${src} に integrity がありません`);
    assert.equal(crossorigin, "anonymous", `${src} に crossorigin="anonymous" がありません`);
    const [algo, expected] = [integrity.slice(0, 6), integrity.slice(7)];
    const actual = createHash(algo).update(readRepoFile(src)).digest("base64");
    assert.equal(actual, expected, `${src} のハッシュが integrity と一致しません（改行コードの変換などで中身が変わった可能性）`);
  }
});

test("vendor/ のスクリプトは配布元（バージョン固定）を data-upstream に記録している", () => {
  for (const { src, upstream } of vendored) {
    const version = src.match(/@(\d+\.\d+\.\d+)\//)?.[1];
    assert.ok(upstream, `${src} に data-upstream がありません`);
    assert.match(upstream, /^https:\/\//);
    assert.ok(upstream.includes(`@${version}/`), `${src} と data-upstream ${upstream} のバージョンが一致しません`);
  }
});

test("vendor/ の各ライブラリにライセンス表示がある", () => {
  for (const { src } of vendored) {
    const dir = src.slice(0, src.lastIndexOf("/"));
    assert.ok(readRepoFile(`${dir}/LICENSE`).length > 0, `${dir}/LICENSE がありません`);
  }
});

test("起動に失敗したときの表示（Vue が動く前）がある", () => {
  assert.match(html, /id="boot"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /function tenbinBootError/);
  for (const { src } of vendored) {
    const tag = html.match(new RegExp(`<script[^>]*src="${src.replace(/[.@/]/g, "\\$&")}"[^>]*>`))[0];
    assert.match(tag, /onerror="tenbinBootError\(/, `${src} の読み込み失敗が表示されません`);
  }
  assert.match(html, /<script type="module" src="app\.js" onerror="tenbinBootError\(/);
});

test("必要時に読み込む kuromoji 本体もバージョン固定 + integrity を持つ", async () => {
  const { readFileSync } = await import("node:fs");
  const dict = JSON.parse(readFileSync(new URL("../data/kuromoji-dict.json", import.meta.url), "utf8"));
  assert.match(dict.script.src, /@\d+\.\d+\.\d+\//);
  assert.match(dict.script.integrity, SRI);
  assert.match(dict.base, /@\d+\.\d+\.\d+\//);
  assert.equal(Object.keys(dict.files).length, 12);
});

// ===== 表示（文字・スマホ） =====

const cssBlock = (selector) => html.match(new RegExp(`\\n\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

test("本文の書体: 日本語フォントと総称ファミリー sans-serif を指定している", () => {
  const family = cssBlock("body").match(/font-family:([^;]*);/)?.[1] ?? "";
  assert.match(family, /sans-serif\s*$/, "最後に sans-serif がありません（日本語の書体がブラウザ任せになる）");
  assert.match(family, /Hiragino Sans|Noto Sans JP|Yu Gothic|Meiryo/, "日本語フォントがありません");
});

test("フォーム部品はページの書体を引き継ぐ", () => {
  assert.match(cssBlock("button, input, select, textarea"), /font-family:\s*inherit/);
});

test("入力欄は 16px 以上（iPhone の Safari が入力時に拡大しない）", () => {
  const size = Number(cssBlock("textarea").match(/font-size:\s*(\d+)px/)?.[1]);
  assert.ok(size >= 16, `textarea の font-size が ${size}px です`);
  assert.match(html, /@media \(pointer: coarse\)\s*\{\s*\.user-dict-form input, \.user-dict-form select \{ font-size: 16px; \}/);
});

// ===== 色のコントラスト（WCAG AA: 文字 4.5:1 以上） =====

const hexOf = (block, prop) => {
  const v = block.match(new RegExp(`(?:^|[;\\s{])${prop}:\\s*([^;]+);`))?.[1]?.trim();
  if (!v) return null;
  if (v === "white") return "#ffffff";
  const m = v.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (!m) return null;
  return "#" + (m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]).toLowerCase();
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test("文字色と背景色のコントラストが 4.5:1 以上", () => {
  // [文字色のブロック, 背景色のブロック（null は白いカード）]
  const pairs = [
    [".muted"], [".footer"], [".morph-status"], [".examples-label"], [".shortcut-hint"], [".score-line"], [".tagline"],
    [".subtitle"], [".input-error"], [".pos-text"], [".neg-text"],
    ["button.primary", "button.primary"], ["button.primary", "button.primary:hover"], ["button.primary", "button.primary:disabled"],
    [".positive", ".positive"], [".negative", ".negative"], [".neutral", ".neutral"], [".abstain", ".abstain"],
    [".badge", ".badge"], [".stale-notice", ".stale-notice"], [".load-error", ".load-error"], [".chip", ".chip"],
    // 文中の語の印とメーター
    [".highlighted", ".highlighted"], ["mark.hl", "mark.hl.positive"], ["mark.hl", "mark.hl.negative"],
    ["mark.hl", "mark.hl.zero"], ["mark.hl.skipped", ".highlighted"], [".meter-labels"], [".meter-note"],
    // 詳細設定・開発者向けの評価ボタン
    [".advanced-state"], ["button.secondary", "button.secondary"], ["button.secondary", "button.secondary:hover"],
    ["button.secondary:disabled", "button.secondary"],
    // まとめて分析
    [".verdict-badge.positive", ".verdict-badge.positive"], [".verdict-badge.negative", ".verdict-badge.negative"],
    [".verdict-badge.neutral", ".verdict-badge.neutral"], [".verdict-badge.abstain", ".verdict-badge.abstain"],
    [".review-no"], [".filter-note"], [".bulk-controls"], [".mode-nav a"], [".mode-nav a.router-link-exact-active"]
  ];
  for (const [fgSel, bgSel] of pairs) {
    const fg = hexOf(cssBlock(fgSel), "color");
    const bg = bgSel ? hexOf(cssBlock(bgSel), "background") : "#ffffff";
    assert.ok(fg && bg, `${fgSel} / ${bgSel} の色を読めません`);
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= 4.5, `${fgSel}（${fg}）on ${bgSel ?? "白"}（${bg}）: ${ratio.toFixed(2)}:1`);
  }
});

test("前の文の結果は、透明度ではなく色を抜いて区別する（文字のコントラストを下げない）", () => {
  const block = cssBlock(".results.stale");
  assert.match(block, /grayscale/);
  assert.doesNotMatch(block, /opacity/);
});

test("スコアの表示（span.score-chip）には、押せるような hover の変化をつけない", () => {
  assert.doesNotMatch(html, /\n\s*\.chip:hover\s*\{/);
  assert.match(html, /button\.chip:hover\s*\{/);
});
