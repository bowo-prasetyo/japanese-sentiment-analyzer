import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));

test("README の擬似API のレスポンス例は、実際の出力と一致する（エンジンや辞書を変えたら README も更新する）", () => {
  const section = readme.slice(readme.indexOf("### 📤 レスポンス例"));
  const text = decodeURIComponent(section.match(/`\?text=([^`]+)`/)[1]);
  const json = section.match(/```json\n([\s\S]*?)\n```/)[1];
  assert.deepEqual(JSON.parse(json), JSON.parse(JSON.stringify(analyzeText(text, config))));
});

test("README の項目の説明は、レスポンスのすべての項目を含む", () => {
  const section = readme.slice(readme.indexOf("### 📤 レスポンス例"));
  const r = analyzeText("見た目は最悪だけど、味は美味しい", config);   // contrastMarker も出る例
  for (const key of Object.keys(r)) {
    assert.match(section, new RegExp("`" + key + "`"), `${key} の説明がありません`);
  }
});
