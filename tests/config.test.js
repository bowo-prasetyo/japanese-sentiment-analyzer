import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../data/config.json", import.meta.url), "utf8")
);

const allWords = new Set(Object.values(config.words).flat());

test("すべてのカテゴリに極性がある", () => {
  for (const category of Object.keys(config.words)) {
    assert.ok(category in config.polarity, `${category} に polarity がありません`);
  }
});

test("groups のカテゴリはすべて words に存在する", () => {
  for (const category of Object.values(config.groups).flat()) {
    assert.ok(category in config.words, `${category} が words にありません`);
  }
});

test("wordPolarity / negatedPolarity / wordExclusions の語は辞書に登録されている", () => {
  for (const key of ["wordPolarity", "negatedPolarity", "wordExclusions"]) {
    for (const word of Object.keys(config[key] ?? {})) {
      assert.ok(allWords.has(word), `${key} の「${word}」が words にありません`);
    }
  }
});

test("negatedPolarity は負の値で、wordPolarity と重複しない", () => {
  for (const [word, value] of Object.entries(config.negatedPolarity)) {
    assert.ok(value < 0, `「${word}」の否定時極性は負の値にしてください`);
    assert.ok(!(word in config.wordPolarity), `「${word}」が wordPolarity と重複しています`);
  }
});

test("レビュー観点カテゴリの語はすべて個別の極性を持つ", () => {
  for (const category of config.groups["レビュー観点"]) {
    for (const word of config.words[category]) {
      assert.ok(
        word in config.wordPolarity || word in config.negatedPolarity,
        `${category} の「${word}」に wordPolarity / negatedPolarity がありません`
      );
    }
  }
});

test("followedBy の語は辞書に登録されている", () => {
  for (const word of Object.keys(config.followedBy ?? {})) {
    assert.ok(allWords.has(word), `followedBy の「${word}」が words にありません`);
  }
});
