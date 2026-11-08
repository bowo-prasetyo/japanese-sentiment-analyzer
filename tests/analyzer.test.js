import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeText, findMatch, cutAtBoundary, findHypotheticalMarker, scopeUntilPunctuation } from "../engine/analyzer.js";

const config = JSON.parse(
  readFileSync(new URL("../data/config.json", import.meta.url), "utf8")
);

const words = (r) => r.matchedWords.map((m) => m.word);

test("「神」は「精神」「神経」の内側ではヒットしない", () => {
  assert.ok(!words(analyzeText("精神的に参った", config)).includes("神"));
  assert.ok(!words(analyzeText("神経をすり減らしている", config)).includes("神"));
});

test("「神」単独の用法はヒットする", () => {
  const r = analyzeText("この漫画は神", config);
  assert.ok(words(r).includes("神"));
  assert.equal(r.result, "positive");
});

test("findMatch は除外複合語の外にある出現を見つける", () => {
  assert.equal(findMatch("精神的に神", "神", ["精神"]), 4);
  assert.equal(findMatch("精神", "神", ["精神"]), -1);
});

test("て形の撥音「ん」を否定とみなさない", () => {
  const r = analyzeText("沈み込んでしまって動けない", config);
  const m = r.matchedWords.find((x) => x.word === "沈み込");
  assert.equal(m.negated, false);
  assert.ok(m.polarity < 0);
});

test("否定スコープはリスト順ではなく最も近い境界で切る", () => {
  assert.equal(cutAtBoundary("んでしまって", ["て", "で"]), "ん");
});

test("「〜ではない」の否定を検出する", () => {
  const r = analyzeText("この店は最悪ではない", config);
  assert.equal(r.matchedWords[0].negated, true);
  assert.notEqual(r.result, "negative");
});

test("「〜ではありません」の否定を検出する", () => {
  const r = analyzeText("最悪ではありません", config);
  assert.equal(r.matchedWords[0].negated, true);
});

test("「〜ていない」の否定を検出する", () => {
  const r = analyzeText("全然怒っていない", config);
  assert.equal(r.matchedWords[0].negated, true);
  assert.notEqual(r.result, "negative");
});

test("「嬉しいわけではない」はポジティブにならない", () => {
  assert.notEqual(analyzeText("嬉しいわけではない", config).result, "positive");
});

test("て形の後の別述語の否定は前の語に波及しない", () => {
  const r = analyzeText("悲しくて泣けない", config);
  const m = r.matchedWords.find((x) => x.word.startsWith("悲し"));
  assert.equal(m.negated, false);
});

test("判定は返却される normalizedScore と threshold に一致する", () => {
  for (const text of ["嬉しい", "嬉しい楽しい", "悲しい", "とても嬉しいが悲しい", "今日は晴れ"]) {
    const r = analyzeText(text, config);
    const expected =
      r.hits === 0 ? "neutral"
      : r.normalizedScore >= r.threshold ? "positive"
      : r.normalizedScore <= -r.threshold ? "negative"
      : "neutral";
    assert.equal(r.result, expected, text);
  }
});

// ===== 最長一致 =====

test("長い語の内側にある短い語は数えない（期待外れ ⊃ 期待）", () => {
  const r = analyzeText("期待外れだった", config);
  assert.deepEqual(words(r), ["期待外れ"]);
  assert.equal(r.result, "negative");
});

test("最長一致: 神対応 は 神 ではなく 神対応 としてヒットする", () => {
  assert.deepEqual(words(analyzeText("神対応でした", config)), ["神対応"]);
});

test("短い語でも、長い語の外にある別の出現は数える", () => {
  const r = analyzeText("期待外れだったが、次に期待", config);
  assert.deepEqual(words(r), ["期待外れ", "期待"]);
});

test("同じ箇所に同じ語が複数カテゴリで登録されていても二重に数えない", () => {
  // 「心細」は 悲しみ と 不安 の両方に登録されている
  assert.equal(analyzeText("心細い", config).hits, 1);
});

test("ヒット単語は文中の出現順に並ぶ", () => {
  const r = analyzeText("悲しいけど嬉しい、でも怖い", { ...config, splitters: [] });
  const idx = r.matchedWords.map((m) => "悲しいけど嬉しい、でも怖い".indexOf(m.word));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

// ===== しきい値 =====

test("しきい値ちょうどの単語1つでも判定できる（±0.5 以上で判定）", () => {
  assert.equal(analyzeText("微妙", config).result, "negative");   // -0.5
  assert.equal(analyzeText("安い", config).result, "positive");   // +0.5
});

// ===== レビュー語彙 =====

const cases = {
  positive: ["このパスタは本当に美味しかった", "スタッフが親切だった", "使いやすいアプリ", "コスパがいい", "おすすめです", "全く飽きない"],
  negative: ["届いてすぐ壊れた", "期待外れだった", "店員が無愛想", "使いにくい", "割高だと思う", "二度と行かない", "がっかりした", "イライラする", "うまくいかず落ち込んだ"],
  neutral: ["最低限の荷物で出かけた", "大丈夫です", "祖母の面倒を見る", "失礼します", "友達が見にくる", "いいえ、違います"]
};

for (const [label, texts] of Object.entries(cases)) {
  for (const text of texts) {
    test(`レビュー語彙: 「${text}」→ ${label}`, () => {
      assert.equal(analyzeText(text, config).result, label);
    });
  }
}

test("否定はレビュー語彙にも効く", () => {
  assert.equal(analyzeText("美味しくない", config).result, "negative");
  assert.equal(analyzeText("使いにくくはない", config).matchedWords[0].negated, true);
});

// ===== 否定されたときだけ数える語（negatedPolarity） =====

test("否定された期待動詞はネガティブになる", () => {
  for (const text of ["暑くて眠れなかった", "エアコンが効かず困った", "全く休めなかった", "電源が入らなくなった", "ネットにつながらない"]) {
    const r = analyzeText(text, config);
    assert.equal(r.result, "negative", text);
  }
});

test("肯定形の期待動詞はヒットに数えない", () => {
  const r = analyzeText("ぐっすり眠れた", config);
  assert.equal(r.hits, 0);
  assert.equal(r.result, "neutral");
});

test("肯定形の期待動詞は他の語のスコアを薄めない", () => {
  const withVerb = analyzeText("美味しくて、ぐっすり眠れた", config);
  const without = analyzeText("美味しくて、ぐっすりした", config);
  assert.equal(withVerb.hits, 1);
  assert.equal(withVerb.normalizedScore, without.normalizedScore);
});

test("ヒット情報に negatedOnly と否定時の極性が入る", () => {
  const m = analyzeText("眠れなかった", config).matchedWords[0];
  assert.equal(m.word, "眠れ");
  assert.equal(m.negatedOnly, true);
  assert.equal(m.negated, true);
  assert.equal(m.base, 0);
  assert.equal(m.polarity, config.negatedPolarity["眠れ"]);
});

test("否定された期待動詞にも強調語が効く", () => {
  const m = analyzeText("とても使えない", config).matchedWords[0];
  assert.equal(m.multiplier, 1.5);
  assert.equal(m.polarity, config.negatedPolarity["使え"] * 1.5);
});

test("否定の例外（〜しかない など）では数えない", () => {
  assert.equal(analyzeText("休めしかない", { ...config, negationExceptions: ["しかない"] }).hits, 0);
});

test("通常の語の否定反転は従来どおり", () => {
  const m = analyzeText("嬉しくない", config).matchedWords[0];
  assert.equal(m.negatedOnly, undefined);
  assert.equal(m.polarity, -1);
});

// ===== 条件・説明の中の語は数えない =====

test("条件（〜ない場合は）の中の否定された期待動詞は数えない", () => {
  const r = analyzeText("動かない場合は、まず電源コードを確認してください", config);
  assert.equal(r.hits, 0);
  assert.equal(r.result, "neutral");
  assert.deepEqual(r.skippedWords.map((s) => [s.word, s.reason, s.marker]), [["動か", "condition", "場合は"]]);
});

test("条件の中の通常の語も、否定の有無にかかわらず数えない", () => {
  for (const text of ["悲しくない場合は連絡してください", "壊れた場合は交換します", "最悪の場合、延期する"]) {
    const r = analyzeText(text, config);
    assert.equal(r.hits, 0, text);
  }
});

test("〜ないときは は条件として扱う", () => {
  assert.equal(analyzeText("効かないときは、医師に相談してください", config).skippedWords[0].reason, "condition");
});

test("対象の説明（〜ための・〜向けの・〜にお悩み）の中の語は数えない", () => {
  for (const text of ["眠れない夜のための音楽", "眠れない毎日を送る人のための本", "疲れやすい人向けのサプリ", "寂しい夜にお悩みの方へ"]) {
    const r = analyzeText(text, config);
    assert.equal(r.hits, 0, text);
    assert.equal(r.skippedWords[0].reason, "description", text);
  }
});

test("条件・説明でない否定や過去の出来事は従来どおり数える", () => {
  const cases = {
    "使えないアプリで、すぐに削除した": "negative",   // 連体修飾でも不満
    "壊れたときは本当に困った": "negative",           // 過去の出来事（〜たときは）
    "雨のため、試合が中止になって残念だった": "negative", // 理由の「ため」（ための ではない）
    "使ったらすぐに壊れた": "negative",               // 継起の「たら」
    "眠れない夜が続いてつらい": "negative"
  };
  for (const [text, label] of Object.entries(cases)) {
    assert.equal(analyzeText(text, config).result, label, text);
    assert.equal(analyzeText(text, config).skippedWords.length, 0, text);
  }
});

test("目印が語より前にある場合は影響しない", () => {
  const r = analyzeText("初めての場合でも、スタッフが丁寧に教えてくれた", config);
  assert.equal(r.result, "positive");
  assert.equal(r.skippedWords.length, 0);
});

test("目印は同じ節（境界まで）の中だけを見る", () => {
  // 「、」で節が切れるので、後ろの「場合」は前の語に影響しない
  const r = analyzeText("料理は美味しかった、雨の場合は送迎もある", config);
  assert.equal(r.result, "positive");
});

test("findHypotheticalMarker は条件を説明より優先して返す", () => {
  const cfg = { conditionMarkers: ["場合"], descriptionMarkers: ["ための"] };
  assert.deepEqual(findHypotheticalMarker("ための場合", cfg), { reason: "condition", marker: "場合" });
  assert.equal(findHypotheticalMarker("ない夜", cfg), null);
});

// ===== 場合: 条件（場合は）と頻度（場合が）を区別する =====

test("「場合は／場合には／場合、／場合でも」は条件として数えない", () => {
  for (const text of ["動かない場合は連絡してください", "動かない場合には連絡してください", "最悪の場合、延期する", "使えない場合でも返金します"]) {
    const r = analyzeText(text, config);
    assert.equal(r.hits, 0, text);
    assert.equal(r.skippedWords[0].reason, "condition", text);
  }
});

test("「場合が多い／場合がある／場合もある」（頻度）は数える", () => {
  for (const text of ["アプリが起動しない場合が多い", "電源が入らない場合がある", "画面が映らない場合もある"]) {
    const r = analyzeText(text, config);
    assert.equal(r.hits, 1, text);
    assert.equal(r.result, "negative", text);
  }
});

test("「場合があります／場合がございます」（丁寧な注意書き）は数えない", () => {
  for (const text of ["古い機種では動かない場合があります", "届かない場合がございます"]) {
    assert.equal(analyzeText(text, config).hits, 0, text);
  }
});

test("節を区切る「、」の直前の「場合」も条件として認識する", () => {
  assert.equal(analyzeText("壊れていた場合、交換します", config).skippedWords[0].marker, "場合、");
});

// ===== よく: 形容詞「良く」だけを数え、副詞（頻繁に・十分に）は数えない =====

test("「よくない／よくなった／よくて」は形容詞として数える", () => {
  assert.equal(analyzeText("あまりよくない", config).result, "negative");
  assert.equal(analyzeText("前よりよくなった", config).result, "positive");
  assert.equal(analyzeText("味もよくて満足", config).matchedWords.some((m) => m.word === "よく"), true);
});

test("副詞の「よく」（よく壊れる・よくある・よく似た）は数えない", () => {
  for (const text of ["よく止まる", "よく聞かれる質問", "よく似た商品", "彼はよく行く", "子どもにはよく、手を洗わせる"]) {
    const r = analyzeText(text, config);
    assert.ok(!r.matchedWords.some((m) => m.word === "よく"), text);
    assert.equal(r.skippedWords.find((s) => s.word === "よく")?.reason, "usage", text);
  }
});

test("「電源が入らない場合がよくあって困っている」はネガティブ", () => {
  assert.equal(analyzeText("電源が入らない場合がよくあって困っている", config).result, "negative");
});

test("「ちょうどよく／ほどよく／気持ちよく／心地よく」は複合語として肯定", () => {
  for (const text of ["量もちょうどよく", "ほどよく冷えている", "気持ちよく過ごせた", "心地よく眠れた"]) {
    assert.equal(analyzeText(text, config).result, "positive", text);
  }
});

test("漢字の「良く」には followedBy を適用しない", () => {
  assert.ok(analyzeText("良く出来ている", config).matchedWords.some((m) => m.word === "良く"));
});

test("条件の目印は「て」「で」で切らず、句読点まで見る（ていた場合・場合でも）", () => {
  assert.equal(analyzeText("壊れていた場合、交換します", config).hits, 0);
  assert.equal(analyzeText("使えない場合でも返金します", config).hits, 0);
});

test("scopeUntilPunctuation は句読点を含めて切り、最大長で止める", () => {
  assert.equal(scopeUntilPunctuation("ていた場合、交換", ["、"], 12), "ていた場合、");
  assert.equal(scopeUntilPunctuation("あいうえおかきくけこさしすせそ", ["、"], 5), "あいうえお");
});

test("複合語と重なる副詞の「よく」は除外一覧にも出さない（ほどよく）", () => {
  const r = analyzeText("肌触りがほどよく柔らかい", config);
  assert.deepEqual(r.matchedWords.map((m) => m.word), ["ほどよ"]);
  assert.deepEqual(r.skippedWords, []);
});

// ===== 否定は最も近い語のもの =====

test("否定は最も近い語にだけ効く（かゆみが治まらない）", () => {
  const r = analyzeText("かゆみが全然治まらない", config);
  const itch = r.matchedWords.find((m) => m.word === "かゆみ");
  assert.equal(itch.negated, false);
  assert.ok(itch.polarity < 0);
  assert.equal(r.result, "negative");
});

test("間に別の辞書語がなければ、これまでどおり否定が効く", () => {
  assert.equal(analyzeText("全然嬉しくない", config).matchedWords[0].negated, true);
  assert.equal(analyzeText("最悪ではない", config).matchedWords[0].negated, true);
});

// ===== v0.9.0 語彙（観点ごとの代表例） =====

const vocabCases = {
  positive: [
    "香ばしくて美味しい", "やみつきになる味", "箸が止まらない", "長持ちするので助かる", "高級感がある",
    "扱いやすいサイズ", "重宝しています", "手放せない", "とても役立つ", "仕事がはかどる",
    "気配りが素晴らしい", "親身になってくれた", "良心的な価格", "感心した", "納得の味",
    "買ってよかった", "文句なしの出来", "完璧でした", "かわいいデザイン", "絶景だった"
  ],
  negative: [
    "脂っこくて胃もたれした", "パサパサしている", "すぐに破れた", "画面が割れた", "色落ちがひどい",
    "使いづらい", "すぐフリーズする", "動作が重い", "読み込みが遅い", "横柄な態度",
    "たらい回しにされた", "割に合わない", "損した気分", "完全に失敗した", "買わなきゃよかった",
    "台無しだった", "詐欺みたいな商品", "肌がかぶれた", "かゆみが出た", "部屋にカビがあった"
  ],
  neutral: [
    "複雑な手順を説明する", "当たり外れがある商品だ", "割れ物の発送について", "ノイズキャンセリング機能付き",
    "進捗を報告する", "カビ取り剤を買った", "失敗しない選び方", "夜遅い時間に届く",
    "困っている人を助ける", "困ったときは窓口へ"
  ]
};

for (const [label, texts] of Object.entries(vocabCases)) {
  for (const text of texts) {
    test(`v0.9.0 語彙: 「${text}」→ ${label}`, () => {
      assert.equal(analyzeText(text, config).result, label);
    });
  }
}

test("v0.9.0 語彙の否定（役立たない・納得いかない・失敗しない）", () => {
  assert.equal(analyzeText("全く役立たない", config).result, "negative");
  assert.equal(analyzeText("どうしても納得いかない", config).result, "negative");
  assert.equal(analyzeText("気遣いが足りない", config).result, "negative");
});

// ===== v0.10.0 語彙（結果の描写） =====

const outcomeCases = {
  positive: [
    "最後まで目が離せない", "時間を忘れて遊んだ", "一気に読んでしまった", "長年の悩みが解消した",
    "新品のように見違えた", "気兼ねなく過ごせた", "修理で元通りになった", "問題なく使えている",
    "思わぬ掘り出し物", "サイズがぴったり"
  ],
  negative: [
    "再生が途中で止まる", "すぐにアプリが固まる", "写真と違う商品が届いた", "部品が一つ足りない",
    "半分しか入っていない", "発送の連絡がない", "呼んでも来ない", "肌に合わなかった",
    "何度も目が覚めた", "途中で寝てしまった", "要望に応じてもらえない", "担当者がつかまらない",
    "片方から音が出ない", "変更が反映されていない", "きつくて履けない", "洗濯したら色移りした"
  ],
  neutral: [
    "追加料金なしで利用できる", "電池が切れたので交換した", "長く使えるかどうか調べている"
  ]
};

for (const [label, texts] of Object.entries(outcomeCases)) {
  for (const text of texts) {
    test(`v0.10.0 語彙: 「${text}」→ ${label}`, () => {
      assert.equal(analyzeText(text, config).result, label);
    });
  }
}

test("否定されたときだけ数える語（v0.10.0 追加分）は肯定形では数えない", () => {
  for (const text of ["快く応じてもらえた", "すぐ担当者がつかまった", "ちゃんと音が出る", "設定が反映された", "楽に履ける"]) {
    assert.ok(!analyzeText(text, config).matchedWords.some((m) => m.negatedOnly), text);
  }
});

test("「〜しか…ない」「いつまで経っても…ない」の否定は句の一部なので反転しない", () => {
  for (const text of ["中身が半分しか入っていなかった", "いつまで経っても料理が来ない"]) {
    assert.equal(analyzeText(text, config).result, "negative", text);
  }
});

test("「〜かどうか」（間接疑問）の中の語は数えない", () => {
  const r = analyzeText("長く使えるかどうか調べている", config);
  assert.equal(r.hits, 0);
  assert.equal(r.skippedWords[0].marker, "かどうか");
});
