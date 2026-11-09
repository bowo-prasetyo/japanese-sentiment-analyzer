import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText, isNegationToken, morphology } from "../engine/analyzer.js";
import { loadTokenizer } from "../scripts/tokenizer.js";

const config = JSON.parse(readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
const tokenizer = await loadTokenizer();
const withMorph = (text, cfg = config) => analyzeText(text, cfg, { tokenizer });
const words = (r) => r.matchedWords.map((m) => m.word);

// ===== 否定の形態素 =====

test("否定の形態素: 助動詞ない・ぬ（ず）・ん、形容詞ない", () => {
  const neg = (text) => tokenizer.tokenize(text).filter(isNegationToken).map((t) => t.surface_form);
  assert.deepEqual(neg("眠れなかった"), ["なかっ"]);
  assert.deepEqual(neg("効かず"), ["ず"]);
  assert.deepEqual(neg("嬉しくありません"), ["ん"]);
  assert.deepEqual(neg("最悪ではない"), ["ない"]);
});

test("「少ない」「危ない」の「ない」、「必ず」の「ず」は否定ではない", () => {
  for (const text of ["人が少ない", "危ない", "必ず"]) {
    assert.deepEqual(tokenizer.tokenize(text).filter(isNegationToken), [], text);
  }
});

test("形容詞「少ない」の中の「ない」で前の語を反転させない", () => {
  // 文字列モードでは「少ない」の「ない」で「嬉し」が反転してしまう
  const text = "嬉しい悩みは少ない";
  assert.equal(analyzeText(text, config).matchedWords[0].negated, true);
  assert.equal(withMorph(text).matchedWords[0].negated, false);
});

test("文字列の窓で途切れる否定も、形態素の位置で検出できる", () => {
  // 「期待に全然応えられなかった」: 「なかった」は8文字の窓の外にはみ出すが、否定の形態素は窓の中で始まる
  // （「期待に応え」は辞書の語なので、間に語をはさんで「期待」だけが一致するようにする）
  const r = withMorph("期待に全然応えられなかった");
  assert.equal(r.matchedWords.find((m) => m.word === "期待").negated, true);
});

test("従来の否定の例は形態素解析でも同じ結果になる", () => {
  for (const [text, label] of [
    ["嬉しくない", "negative"], ["最悪ではない", "positive"], ["全然怒っていない", "positive"],
    ["暑くて眠れなかった", "negative"], ["かゆみが全然治まらない", "negative"],
    ["二度とあの店には行かない", "negative"], ["中身が半分しか入っていなかった", "negative"]
  ]) {
    assert.equal(withMorph(text).result, label, text);
  }
});

// ===== 語の境界 =====

test("短い語は形態素の先頭からしか一致しない（除外リストがなくても「精神」の「神」を数えない）", () => {
  const noExclusions = { ...config, wordExclusions: {} };
  assert.ok(words(analyzeText("精神科の予約", noExclusions)).includes("神"));       // 文字列モード
  assert.ok(!words(withMorph("精神科の予約", noExclusions)).includes("神"));        // 形態素解析
  assert.ok(words(withMorph("この漫画は神", noExclusions)).includes("神"));
});

test("長い語は複合語の内側でも一致する（お気に入り の 気に入）", () => {
  assert.ok(words(withMorph("お気に入りのカフェ")).includes("気に入"));
});

test("境界チェックの長さは boundaryCheckMaxLength で決まる", () => {
  const m = morphology("精神", tokenizer);
  assert.ok(m.tokenStarts.has(0));
  assert.ok(!m.tokenStarts.has(1));
  assert.equal(config.boundaryCheckMaxLength, 2);
});

// ===== フォールバック・その他 =====

test("tokenizer を渡さなければ従来どおり（morphology: false）", () => {
  const r = analyzeText("嬉しい", config);
  assert.equal(r.morphology, false);
  assert.equal(withMorph("嬉しい").morphology, true);
});

test("逆接（けど）の後半にも形態素解析が使われる", () => {
  const r = withMorph("高いけど、悩みは少ない");
  assert.equal(r.debugLabel, "contrast_override");
  assert.equal(r.morphology, true);
});

test("気持ちいい・心地いい は複合語として肯定", () => {
  for (const text of ["汚れが落ちて気持ちいい", "心地いい音"]) {
    assert.equal(withMorph(text).result, "positive", text);
  }
});
