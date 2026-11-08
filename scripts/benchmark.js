// 固定ブラインドベンチマーク
//
// 使い方:
//   npm run bench                 集計結果だけを表示（個々の誤判定は表示しない）
//   npm run bench -- --summary    GitHub Actions のジョブサマリーにも書き出す（CI 用）
//   npm run bench -- --record     現在のバージョンのスコアを data/benchmark/history.json に記録
//
// ルール:
//   - 個々の文や誤判定は表示しない（見ると辞書の調整に使ってしまうため）。--errors はない
//   - ファイルは SHA-256 で固定。中身を変えたいときは新しい版（b2 など）を追加する
//   - スコアは報告のみで、CI を失敗させない（合否に使うと調整の目標になってしまうため）
import { writeFileSync, appendFileSync } from "node:fs";
import { evaluate, LABELS } from "../engine/evaluator.js";
import { root, readJson, loadBenchmark } from "./benchmark-lib.js";

const args = process.argv.slice(2);
if (args.includes("--errors")) {
  console.error("ベンチマークでは個々の誤判定を表示できません（ブラインドを保つため）。");
  process.exit(2);
}

const pct = (x) => (x * 100).toFixed(1) + "%";
const config = readJson("data/config.json");
const version = readJson("package.json").version;
const manifest = readJson("data/benchmark/manifest.json");
const history = readJson("data/benchmark/history.json");

const summary = [];
for (const id of Object.keys(manifest)) {
  const bench = loadBenchmark(id);
  const e = evaluate(bench.items, config);
  const r = { benchmark: id, version, macroF1: +e.macroF1.toFixed(4), accuracy: +e.accuracy.toFixed(4), noHit: e.noHitCases.length, total: e.total };

  console.log(`\n== ${id}（固定 ${bench.frozen}, ${e.total}件） v${version}`);
  console.log(`macro-F1 ${pct(e.macroF1)}   accuracy ${pct(e.accuracy)}   no-hit ${e.noHitCases.length}`);
  console.log("\n  class      precision  recall   F1      support");
  for (const l of LABELS) {
    const c = e.perClass[l];
    console.log(`  ${l.padEnd(9)}  ${pct(c.precision).padStart(6)}     ${pct(c.recall).padStart(6)}   ${pct(c.f1).padStart(6)}  ${c.support}`);
  }
  console.log("\n  gold \\ pred  " + LABELS.map((l) => l.slice(0, 3).padStart(5)).join(""));
  for (const g of LABELS) {
    console.log("  " + g.padEnd(12) + LABELS.map((p) => String(e.confusion[g][p]).padStart(5)).join(""));
  }

  const past = history.filter((h) => h.benchmark === id);
  if (past.length) {
    console.log("\n  履歴:");
    for (const h of past) console.log(`    v${h.version}  macro-F1 ${pct(h.macroF1)}  (${h.date})`);
  }

  summary.push({ r, past });

  if (args.includes("--record")) {
    if (past.some((h) => h.version === version)) {
      console.error(`\nv${version} の ${id} のスコアは記録済みです。バージョンを上げてから記録してください。`);
      process.exit(1);
    }
    history.push({ ...r, date: new Date().toISOString().slice(0, 10) });
    writeFileSync(root + "data/benchmark/history.json", JSON.stringify(history, null, 2) + "\n");
    console.log(`\n${id} の v${version} のスコアを data/benchmark/history.json に記録しました`);
  }
}

if (args.includes("--summary") && process.env.GITHUB_STEP_SUMMARY) {
  const lines = ["## 固定ブラインドベンチマーク（報告のみ）", "", "| ベンチマーク | バージョン | Macro-F1 | Accuracy | ヒットなし |", "| --- | --- | --- | --- | --- |"];
  for (const { r, past } of summary) {
    for (const h of past) lines.push(`| ${h.benchmark} | v${h.version}（記録） | ${pct(h.macroF1)} | ${pct(h.accuracy)} | ${h.noHit}/${h.total} |`);
    lines.push(`| ${r.benchmark} | **この PR** | **${pct(r.macroF1)}** | ${pct(r.accuracy)} | ${r.noHit}/${r.total} |`);
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
