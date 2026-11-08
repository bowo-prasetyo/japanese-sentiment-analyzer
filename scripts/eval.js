// 使い方:
//   npm run eval                          開発用セット + ホールドアウトの指標を表示
//   npm run eval -- --errors              誤判定も表示
//   npm run eval -- --check               ベースラインより Macro-F1 が下がったら失敗（CI 用）
//   npm run eval -- --update-baseline     現在の Macro-F1 をベースラインとして保存
//   npm run eval -- --only dev            開発用セットだけ評価（辞書の調整中はこれを使い、ホールドアウトを見ない）
//   npm run eval -- --no-morphology       形態素解析を使わずに評価（文字列だけのモード。比較用）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluate, LABELS } from "../engine/evaluator.js";
import { loadTokenizer } from "./tokenizer.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = (p) => JSON.parse(readFileSync(root + p, "utf8"));
const BASELINE_PATH = "data/eval-baseline.json";

const config = load("data/config.json");
const sets = {
  dev: { file: "testset.json", data: load("data/testset.json") },
  holdout: { file: "holdout.json", data: load("data/holdout.json") }
};

const args = process.argv.slice(2);
const showErrors = args.includes("--errors");
const check = args.includes("--check");
const updateBaseline = args.includes("--update-baseline");
const onlyIndex = args.indexOf("--only");
const only = onlyIndex === -1 ? null : args[onlyIndex + 1];

if (only && !sets[only]) {
  console.error(`--only には ${Object.keys(sets).join(" / ")} のいずれかを指定してください`);
  process.exit(2);
}
if (only && updateBaseline) {
  console.error("--update-baseline は全セットで実行してください（--only と併用不可）");
  process.exit(2);
}

const pct = (x) => (x * 100).toFixed(1).padStart(5) + "%";
const current = {};
const tokenizer = args.includes("--no-morphology") ? null : await loadTokenizer();
console.log(`形態素解析: ${tokenizer ? "有効" : "無効（文字列モード）"}`);

for (const [key, { file, data }] of Object.entries(sets)) {
  if (only && key !== only) continue;
  const e = evaluate(data, config, { tokenizer });
  current[key] = { macroF1: e.macroF1, accuracy: e.accuracy, total: e.total };

  console.log(`\n== ${key} (${file})  n=${e.total}`);
  console.log(`macro-F1 ${pct(e.macroF1)}   accuracy ${pct(e.accuracy)}   no-hit ${e.noHitCases.length}`);
  console.log(`coverage ${pct(e.coverage)}   accuracy on decided ${pct(e.accuracyOnDecided)}`);

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

if (updateBaseline) {
  const rounded = Object.fromEntries(
    Object.entries(current).map(([k, v]) => [k, { macroF1: +v.macroF1.toFixed(4), total: v.total }])
  );
  writeFileSync(root + BASELINE_PATH, JSON.stringify(rounded, null, 2) + "\n");
  console.log(`\nベースラインを更新しました: ${BASELINE_PATH}`);
}

if (check) {
  const baseline = load(BASELINE_PATH);
  // ベースラインは小数4桁で保存しているため、丸め誤差分だけ許容する
  const TOLERANCE = 0.00005;
  let failed = false;

  console.log("\n== baseline check (macro-F1)");
  for (const [key, base] of Object.entries(baseline)) {
    if (only && key !== only) continue;
    const now = current[key];
    if (!now) {
      console.log(`  ✗ ${key}: 評価セットが見つかりません`);
      failed = true;
      continue;
    }
    const ok = now.macroF1 >= base.macroF1 - TOLERANCE;
    const mark = ok ? "✓" : "✗";
    console.log(`  ${mark} ${key}: ${pct(now.macroF1)}（ベースライン ${pct(base.macroF1)}）`);
    if (!ok) failed = true;
    else if (now.macroF1 > base.macroF1 + TOLERANCE) {
      console.log(`    ↑ 改善しています。npm run eval -- --update-baseline でベースラインを更新してください`);
    }
  }

  if (failed) {
    console.error("\nMacro-F1 がベースラインを下回りました。");
    process.exit(1);
  }
}
