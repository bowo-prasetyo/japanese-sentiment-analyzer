import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson, sha256OfFile, loadBenchmark } from "../scripts/benchmark-lib.js";
import { LABELS } from "../engine/evaluator.js";

// 注意: 失敗メッセージにベンチマークの文そのものを出さない（件数や ID だけを出す）

const manifest = readJson("data/benchmark/manifest.json");

test("ベンチマークは固定時の SHA-256 と一致する（編集禁止。変更は新しい版で）", () => {
  for (const [id, entry] of Object.entries(manifest)) {
    assert.equal(sha256OfFile(`data/benchmark/${entry.file}`), entry.sha256, `${id} が変更されています`);
  }
});

for (const id of Object.keys(manifest)) {
  const bench = loadBenchmark(id);

  test(`${id}: 形式（ID 一意・ラベル有効・件数が manifest と一致）`, () => {
    const ids = bench.items.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, "ID が重複しています");
    assert.ok(bench.items.every((x) => LABELS.includes(x.label)), "不正なラベルがあります");
    assert.equal(bench.items.length, manifest[id].items);
  });

  test(`${id}: 出典・ラベル付けの基準・一致率が記録されている`, () => {
    for (const key of ["source", "labelingGuide", "labelCheck", "frozen"]) {
      assert.ok(bench[key], `${key} がありません`);
    }
  });

  test(`${id}: 開発用セット・ホールドアウトと文が重複しない`, () => {
    const seen = new Set(
      ["data/testset.json", "data/holdout.json"].flatMap((p) => readJson(p).map((x) => x.text))
    );
    const overlap = bench.items.filter((x) => seen.has(x.text)).map((x) => x.id);
    assert.deepEqual(overlap, [], `重複している ID: ${overlap.join(", ")}`);
  });
}

test("history.json の記録は既知のベンチマークを指し、同じ版の重複がない", () => {
  const history = readJson("data/benchmark/history.json");
  const keys = new Set();
  for (const h of history) {
    assert.ok(h.benchmark in manifest, `${h.benchmark} は manifest にありません`);
    const key = `${h.benchmark}@${h.version}`;
    assert.ok(!keys.has(key), `${key} が重複しています`);
    keys.add(key);
  }
});
