import { test } from "node:test";
import assert from "node:assert/strict";
import { externalScripts, readIndexHtml } from "../scripts/cdn-scripts.js";

const scripts = externalScripts(readIndexHtml());

test("外部スクリプトが存在する（抽出の健全性チェック）", () => {
  assert.ok(scripts.length >= 2);
});

test("CDN スクリプトは正確なバージョンに固定されている", () => {
  for (const { src } of scripts) {
    // 例: vue@3.5.44 — 「vue@3」や「vue」のような範囲指定は不可
    assert.match(src, /@\d+\.\d+\.\d+\//, `${src} はバージョンが固定されていません`);
  }
});

test("CDN スクリプトには integrity と crossorigin がある", () => {
  for (const { src, integrity, crossorigin } of scripts) {
    assert.match(integrity ?? "", /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/, `${src} に integrity がありません`);
    assert.equal(crossorigin, "anonymous", `${src} に crossorigin="anonymous" がありません`);
  }
});

test("必要時に読み込む kuromoji 本体もバージョン固定 + integrity を持つ", async () => {
  const { readFileSync } = await import("node:fs");
  const dict = JSON.parse(readFileSync(new URL("../data/kuromoji-dict.json", import.meta.url), "utf8"));
  assert.match(dict.script.src, /@\d+\.\d+\.\d+\//);
  assert.match(dict.script.integrity, /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/);
  assert.match(dict.base, /@\d+\.\d+\.\d+\//);
  assert.equal(Object.keys(dict.files).length, 12);
});
