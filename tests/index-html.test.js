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
