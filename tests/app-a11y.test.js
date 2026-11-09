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
