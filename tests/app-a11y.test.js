import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// app.js のテンプレート（文字列）を静的に確かめる
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("各画面は <main> でくくる（ランドマーク）", () => {
  assert.equal((app.match(/<main class="card">/g) ?? []).length, 2);
  assert.equal((app.match(/<\/main>/g) ?? []).length, 2);
  assert.doesNotMatch(app, /<div class="card">/);
});

test("判定を読み上げる領域は、結果の有無にかかわらず常にある", () => {
  const line = app.split("\n").find((l) => l.includes('role="status" aria-live="polite"'));
  assert.ok(line, "読み上げ領域がありません");
  assert.match(line, /class="visually-hidden"/);
  assert.doesNotMatch(line, /v-if/);
});

test("表の見出しは空にしない（削除の列）", () => {
  assert.doesNotMatch(app, /<th>語<\/th><th>極性<\/th><th>カテゴリ<\/th><th><\/th>/);
});

test("形態素解析は「詳細設定」の中にあり、見出しに状態を出す", () => {
  const details = app.match(/<details class="advanced">([\s\S]*?)<\/details>/)?.[1] ?? "";
  assert.match(details, /形態素解析を使う/);
  assert.match(details, /<summary>詳細設定[^<]*<span class="advanced-state">（形態素解析: \{\{ morphSummary \}\}）/);
  assert.equal((app.match(/形態素解析を使う/g) ?? []).length, 1, "詳細設定の外にも形態素解析の切り替えがあります");
});

test("開発者向け画面: 評価ボタンは控えめ（primary ではない）で、画面ごとにタブの題名を変える", () => {
  assert.match(app, /v-for="\(s, key\) in testsets"[^>]*class="secondary"/);
  assert.doesNotMatch(app, /v-for="\(s, key\) in testsets"[^>]*class="primary"/);
  assert.match(app, /router\.afterEach/);
  assert.match(app, /path: "\/dev"[^\n]*meta: \{ title:/);
});
