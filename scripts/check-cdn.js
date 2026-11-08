// CDN から実際にファイルを取得し、index.html の integrity（SRI）と一致するか確認する。
// ネットワークが必要なため CI で実行する: npm run check:cdn
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { externalScripts, readIndexHtml } from "./cdn-scripts.js";

let failed = false;

// index.html の <script> に加え、kuromoji の辞書ファイル（XHR で読むため SRI を付けられない）も検証する
const dict = JSON.parse(readFileSync(new URL("../data/kuromoji-dict.json", import.meta.url), "utf8"));
const targets = [
  ...externalScripts(readIndexHtml()),
  ...Object.entries(dict.files).map(([file, integrity]) => ({ src: dict.base + file, integrity }))
];

for (const { src, integrity } of targets) {
  if (!integrity) {
    console.error(`✗ ${src}: integrity 属性がありません`);
    failed = true;
    continue;
  }

  const [algo, expected] = [integrity.slice(0, 6), integrity.slice(7)];
  const res = await fetch(src);
  if (!res.ok) {
    console.error(`✗ ${src}: HTTP ${res.status}`);
    failed = true;
    continue;
  }

  const body = Buffer.from(await res.arrayBuffer());
  const actual = createHash(algo).update(body).digest("base64");

  if (actual === expected) {
    console.log(`✓ ${src}`);
  } else {
    console.error(`✗ ${src}: SRI 不一致\n  expected ${algo}-${expected}\n  actual   ${algo}-${actual}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
