# 擬似API（Pseudo API）

URL のパラメータで文を渡すと、分析結果を JSON の形で画面に表示するページです。

> **本物の API ではありません。** 返すのは HTML で、JavaScript を実行して JSON を表示します。
> そのため、`curl` などでは結果を取れません。ブラウザ、または Playwright などのブラウザを動かすツールで使います。

| 項目 | 擬似API | 本物の API |
| --- | --- | --- |
| レスポンス | HTML（JavaScript で JSON を表示） | JSON |
| Content-Type | `text/html` | `application/json` |
| `curl` で使えるか | ❌ | ✔ |
| JavaScript の実行 | 必要 | 不要 |

## 使い方

`text` パラメータに分析する文を入れます。

```
https://bowo-prasetyo.github.io/japanese-sentiment-analyzer/pseudo-api/?text=今日は嬉しい
```

しくみ: URL → HTML を読み込む → JavaScript が分析する → JSON を画面に表示する

* 文字列モード（形態素解析なし）で分析します。1回ごとに約18MB の辞書を読み込まないようにするためです。
* 組み込み辞書だけを使います。ユーザー辞書は使いません。
* `text` が空か空白だけのときは、`{"error":"text parameter required"}` を表示します。
  辞書を読み込めなかったときなどは、`{"error":"internal error","detail":"…"}` を表示します。

### 制限

* POST は使えません（GET の URL パラメータだけ）。
* URL の長さに上限があるため、長い文は送れません。
* JavaScript の実行が必要です。

## プログラムから使う例（Playwright）

```javascript
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const text = encodeURIComponent("今日は嬉しい");
await page.goto(`https://bowo-prasetyo.github.io/japanese-sentiment-analyzer/pseudo-api/?text=${text}`);
await page.waitForFunction(() => document.body.textContent.trim().startsWith("{"));
const result = JSON.parse(await page.evaluate(() => document.body.textContent));
console.log(result.result); // "positive"
await browser.close();
```

Node.js から直接使うなら、擬似API を通さずに `engine/analyzer.js` の `analyzeText(text, config)` を呼ぶほうが簡単です。

---

### 📤 レスポンス例

`?text=今日は嬉しい` のレスポンス（`tests/readme.test.js` が、実際の出力と一致するかを確かめています）:

```json
{
  "result": "positive",
  "score": 1,
  "normalizedScore": 1,
  "threshold": 0.5,
  "hits": 1,
  "matchedWords": [
    { "word": "嬉し", "category": "喜び", "base": 1, "polarity": 1, "negated": false, "multiplier": 1, "index": 3 }
  ],
  "skippedWords": [],
  "categoryScore": { "喜び": 1 },
  "debugLabel": "neutral",
  "morphology": false,
  "abstained": false
}
```

### 項目

| 項目 | 内容 |
| --- | --- |
| `result` | 判定。`positive` / `negative` / `neutral`。**「判定できません」のときも `neutral`** になるので、`abstained` で区別する |
| `abstained` | `true` なら「判定できません」（極性を持つ語が1つもなかった）。中立という判定ではない |
| `normalizedScore` | 判定スコア（合計 ÷ √ヒット数）。`threshold` 以上ならポジティブ、`-threshold` 以下ならネガティブ |
| `threshold` | しきい値（いまは 0.5） |
| `score` | 極性の合計 |
| `hits` | 極性を持つ語（ヒット）の数 |
| `matchedWords` | 判定に使った語。`base`（辞書の極性）に否定（`negated`）と強調の倍率（`multiplier`）を当てた結果が `polarity`。`index` は文中の位置（0 から数える）。否定されたときだけ数える語は `negatedOnly: true` と `negatedPolarity` も持つ |
| `skippedWords` | 見つかったが数えなかった語。`reason` は `condition`（条件）/ `description`（説明）/ `usage`（用法）/ `contrast`（逆接より前）。`marker` は目印の語 |
| `categoryScore` | カテゴリ（観点・感情カテゴリ）ごとの極性の合計 |
| `contrastMarker` | 逆接（けど・のに など）で後半だけを判定したときの、その逆接の語。逆接がなければ出力しない |
| `debugLabel` | 開発用の内部の印。`no_hit`（ヒットなし）・`contrast_override`（逆接で後半を優先）のどちらでもなければ `"neutral"`。判定の結果ではないので、判定には `result` と `abstained` を使う |
| `morphology` | 形態素解析を使ったか（擬似API では常に `false`） |
