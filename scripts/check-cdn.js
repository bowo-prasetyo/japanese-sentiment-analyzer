// 配布元（CDN）から実際にファイルを取得し、index.html の integrity（SRI）と一致するか確認する。
// ネットワークが必要なため CI で実行する: npm run check:cdn
//   - vendor/ に置いた Vue・Vue Router: 配布元（data-upstream）のファイルが同じハッシュか
//     （リポジトリ内のファイル自体のハッシュは npm test で確認する）
//   - 外部から読み込むスクリプトと、必要時に読み込む kuromoji 本体・辞書
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { externalScripts, vendoredScripts, readIndexHtml } from "./cdn-scripts.js";

let failed = false;

// 辞書は XHR で読むため、ブラウザでは SRI を付けられない。ここで検証する
const dict = JSON.parse(readFileSync(new URL("../data/kuromoji-dict.json", import.meta.url), "utf8"));
const html = readIndexHtml();
const targets = [
  ...vendoredScripts(html).map(({ upstream, integrity }) => ({ src: upstream, integrity })),
  ...externalScripts(html),
  dict.script,
  ...Object.entries(dict.files).map(([file, integrity]) => ({ src: dict.base + file, integrity }))
];

for (const { src, integrity } of targets) {
  if (!src) {
    console.error("✗ vendor/ のスクリプトに data-upstream（配布元の URL）がありません");
    failed = true;
    continue;
  }
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
