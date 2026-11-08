import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const readJson = (p) => JSON.parse(readFileSync(root + p, "utf8"));

export function sha256OfFile(p) {
  return createHash("sha256").update(readFileSync(root + p)).digest("hex");
}

// manifest.json に記録した SHA-256 と一致することを確認してから読み込む
export function loadBenchmark(id) {
  const entry = readJson("data/benchmark/manifest.json")[id];
  if (!entry) throw new Error(`ベンチマーク ${id} が manifest.json にありません`);
  const path = `data/benchmark/${entry.file}`;
  if (sha256OfFile(path) !== entry.sha256) {
    throw new Error(`ベンチマーク ${id} の内容が固定時と異なります（SHA-256 不一致）。編集せず、新しい版を追加してください。`);
  }
  return readJson(path);
}
