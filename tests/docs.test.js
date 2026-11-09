import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";

const doc = readFileSync(new URL("../docs/pseudo-api.md", import.meta.url), "utf8");
const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));

test("docs/pseudo-api.md のレスポンス例は、実際の出力と一致する（エンジンや辞書を変えたら文書も更新する）", () => {
  const section = doc.slice(doc.indexOf("### 📤 レスポンス例"));
  const text = decodeURIComponent(section.match(/`\?text=([^`]+)`/)[1]);
  const json = section.match(/```json\n([\s\S]*?)\n```/)[1];
  assert.deepEqual(JSON.parse(json), JSON.parse(JSON.stringify(analyzeText(text, config))));
});

test("docs/pseudo-api.md の項目の説明は、レスポンスのすべての項目を含む", () => {
  const section = doc.slice(doc.indexOf("### 📤 レスポンス例"));
  const r = analyzeText("見た目は最悪だけど、味は美味しい", config);   // contrastMarker も出る例
  for (const key of Object.keys(r)) {
    assert.match(section, new RegExp("`" + key + "`"), `${key} の説明がありません`);
  }
});

// ===== 文書の中のリンク: 相対リンクの先のファイルと、#見出し が存在する =====
const DOCS = ["README.md", "CONTRIBUTING.md", "CHANGELOG.md", "docs/user-guide.md", "docs/glossary.md", "docs/dictionary.md", "docs/evaluation.md", "docs/pseudo-api.md", "docs/releases/v0.16.0.md"];
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

// GitHub と同じ規則で、見出しからアンカーを作る（小文字にし、記号を除き、空白を - にする）
function anchors(markdown) {
  const body = markdown.replace(/```[\s\S]*?```/g, "");
  return new Set([...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, h]) =>
    h.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/\s/g, "-")));
}

function resolve(from, target) {
  const parts = from.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

for (const file of DOCS) {
  test(`${file} の相対リンクは、存在するファイルと見出しを指す`, () => {
    const markdown = read(file);
    const links = [
      ...[...markdown.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]),
      ...[...markdown.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1])
    ].filter((href) => !/^[a-z]+:/.test(href));
    for (const href of links) {
      const [path, hash] = href.split("#");
      const target = path ? resolve(file, path) : file;
      let content;
      assert.doesNotThrow(() => { content = read(target); }, `${file}: ${href} のファイルがありません`);
      if (hash && target.endsWith(".md")) {
        assert.ok(anchors(content).has(decodeURIComponent(hash)), `${file}: ${href} の見出しがありません`);
      }
    }
  });
}
