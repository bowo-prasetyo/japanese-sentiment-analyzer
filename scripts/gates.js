// 辞書を変えたときの確認（README「語彙の作り方」のゲート 2〜4）。開発用セットだけを使う。
//   npm run gates                 HEAD の辞書と、作業中の辞書（data/config.json）を比べる
//   npm run gates -- <コミット>   指定したコミットの辞書と比べる
//
// ゲート（どれか1件でもあれば失敗）
//   2. 中立の文に、新しくヒットする語がない（中立と判定されたままでも、語が増えたら数える）
//   3. 正しかった文が誤りにならない
//   4. 逆の極性（ポジティブ ⇄ ネガティブ）に動いた文がない
// 形態素解析あり（Node の既定）と文字列モード（ブラウザの既定）の両方で確かめる。
// ホールドアウト・固定ブラインドベンチマークは読まない（辞書の調整に使わないため）。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { analyzeText } from "../engine/analyzer.js";
import { loadTokenizer } from "./tokenizer.js";

const base = process.argv[2] ?? "HEAD";
const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const before = JSON.parse(execFileSync("git", ["show", `${base}:data/config.json`], { encoding: "utf8" }));
const after = readJson("data/config.json");
const dev = readJson("data/testset.json");

const hitWords = (r) => new Set(r.matchedWords.filter((m) => m.polarity !== 0).map((m) => m.word));
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const report = (title, list, fmt) => {
  console.log(`${list.length ? "✗" : "✓"} ${title}: ${list.length}`);
  for (const x of list) console.log(`    ${fmt(x)}`);
};

let failed = false;
for (const [modeName, tokenizer] of [["形態素解析あり", await loadTokenizer()], ["文字列モード", null]]) {
  const run = (config, text) => analyzeText(text, config, { tokenizer });
  const fixed = [], broken = [], neutralHits = [], opposite = [];
  let decidedBefore = 0, decidedAfter = 0, sentiment = 0;

  for (const { text, label } of dev) {
    const a = run(before, text), b = run(after, text);
    if (label !== "neutral") {
      sentiment++;
      if (!a.abstained) decidedBefore++;
      if (!b.abstained) decidedAfter++;
    }
    const wasRight = a.result === label, isRight = b.result === label;
    if (!wasRight && isRight) fixed.push({ text, label, from: a.result });
    if (wasRight && !isRight) broken.push({ text, label, to: b.result });
    if ([a.result, b.result].sort().join() === "negative,positive") opposite.push({ text, label, from: a.result, to: b.result });
    if (label === "neutral") {
      const old = hitWords(a);
      const added = [...hitWords(b)].filter((w) => !old.has(w));
      if (added.length) neutralHits.push({ text, added });
    }
  }

  console.log(`\n== ゲート: ${modeName}（開発用セット ${dev.length} 件、基準: ${base}）`);
  console.log(`ポジティブ・ネガティブの文で判定できた割合: ${pct(decidedBefore, sentiment)} → ${pct(decidedAfter, sentiment)}（${decidedBefore} → ${decidedAfter} / ${sentiment}）`);
  console.log(`正しくなった文: ${fixed.length}`);
  report("ゲート2 中立の文に新しくヒットした語", neutralHits, (x) => `${x.text}  ← ${x.added.join("・")}`);
  report("ゲート3 正しかった文が誤りになった", broken, (x) => `${x.text}（正解 ${x.label} → ${x.to}）`);
  report("ゲート4 逆の極性に動いた", opposite, (x) => `${x.text}（${x.from} → ${x.to}）`);
  if (neutralHits.length || broken.length || opposite.length) failed = true;
}

process.exit(failed ? 1 : 0);
