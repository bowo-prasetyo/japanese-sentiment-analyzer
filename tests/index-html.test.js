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
