// 使い方: npm run eval            （開発用セット + ホールドアウト）
//         npm run eval -- --errors （誤判定も表示）
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluate, LABELS } from "../engine/evaluator.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = (p) => JSON.parse(readFileSync(root + p, "utf8"));

const config = load("data/config.json");
const sets = {
  "dev (testset.json)": load("data/testset.json"),
  "holdout (holdout.json)": load("data/holdout.json")
};
const showErrors = process.argv.includes("--errors");
const pct = (x) => (x * 100).toFixed(1).padStart(5) + "%";

for (const [name, testset] of Object.entries(sets)) {
  const e = evaluate(testset, config);

  console.log(`\n== ${name}  n=${e.total}`);
  console.log(`macro-F1 ${pct(e.macroF1)}   accuracy ${pct(e.accuracy)}   no-hit ${e.noHitCases.length}`);

  console.log("\n  class      precision  recall     F1   support");
  for (const l of LABELS) {
    const c = e.perClass[l];
    console.log(`  ${l.padEnd(9)}  ${pct(c.precision)}   ${pct(c.recall)} ${pct(c.f1)}   ${c.support}`);
  }

  console.log("\n  gold \\ pred  " + LABELS.map((l) => l.slice(0, 3).padStart(5)).join(""));
  for (const g of LABELS) {
    console.log("  " + g.padEnd(12) + LABELS.map((p) => String(e.confusion[g][p]).padStart(5)).join(""));
  }

  if (e.skipped.length) console.log(`\n  ⚠ skipped ${e.skipped.length} item(s) with unknown labels`);

  if (showErrors) {
    console.log("\n  errors:");
    for (const r of e.errorCases) {
      const words = r.matchedWords.map((m) => `${m.word}:${m.polarity.toFixed(2)}`).join(", ");
      console.log(`  ${r.label} → ${r.predicted}  ${r.text}  [${words}]`);
    }
  }
}
