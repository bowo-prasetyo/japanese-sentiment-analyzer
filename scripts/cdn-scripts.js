import { readFileSync } from "node:fs";

// index.html から外部 <script> タグ（src / integrity / crossorigin）を抜き出す
export function externalScripts(html) {
  const tags = html.match(/<script\b[^>]*>/g) || [];
  return tags
    .map((tag) => {
      const attr = (name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
      return { src: attr("src"), integrity: attr("integrity"), crossorigin: attr("crossorigin") };
    })
    .filter((s) => s.src && /^https?:\/\//.test(s.src));
}

export function readIndexHtml() {
  return readFileSync(new URL("../index.html", import.meta.url), "utf8");
}
