// Node 用: kuromoji の tokenizer を一度だけ作る（辞書は node_modules/kuromoji/dict）
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let promise = null;

export function loadTokenizer() {
  promise ??= new Promise((resolve, reject) => {
    const kuromoji = require("kuromoji");
    const dicPath = join(dirname(require.resolve("kuromoji/package.json")), "dict");
    kuromoji.builder({ dicPath }).build((err, tokenizer) => (err ? reject(err) : resolve(tokenizer)));
  });
  return promise;
}
