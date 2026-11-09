import { readFileSync } from "node:fs";

// index.html の <script> タグから src / integrity / crossorigin / data-upstream を抜き出す
export function scriptTags(html) {
  const tags = html.match(/<script\b[^>]*>/g) || [];
  return tags.map((tag) => {
    const attr = (name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    return { src: attr("src"), integrity: attr("integrity"), crossorigin: attr("crossorigin"), upstream: attr("data-upstream") };
  });
}

// 外部（http/https）から読み込む <script>
export function externalScripts(html) {
  return scriptTags(html).filter((s) => s.src && /^https?:\/\//.test(s.src));
}

// リポジトリの vendor/ に置いた外部ライブラリ（data-upstream に配布元の URL を持つ）
export function vendoredScripts(html) {
  return scriptTags(html).filter((s) => s.src && s.src.startsWith("vendor/"));
}

export function readIndexHtml() {
  return readFileSync(new URL("../index.html", import.meta.url), "utf8");
}

export function readRepoFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url));
}
