# Japanese Rule-Based Sentiment Analyzer

> 🚀 Current Version: v0.4.0（3クラス評価 + 否定スコープ改善）

## 🌐 Demo

https://bowo-prasetyo.github.io/japanese-sentiment-analyzer/#/

---

## 🧠 概要

日本語テキストを対象にした**ルールベースの感情分析ツール**です。
ブラウザのみで動作し、辞書（JSON）を編集することで簡単に拡張できます。

---

## ✨ 特徴

* 🟢 **サーバ不要**（100%フロントエンド）
* 🟢 **Vue 3 + Vue Router** によるモダンUI
* 🟢 **JSONベース辞書**でロジックとデータを分離
* 🟢 **3層モデル（単語 → 感情 → 極性）**
* 🟢 **ヒット単語の可視化（Explainable AI）**
* 🟢 **カテゴリ別スコア分析**
* 🟢 **否定表現対応（〜ない）**
* 🟢 **強調語対応（とても、めっちゃ等）**
* 🟢 GitHub Pagesでそのまま公開可能

---

## 🏗️ アーキテクチャ

### 3層モデル

```
単語 → 感情カテゴリ → 極性スコア
```

例：

```
嬉しい → 喜び → +1
ムカつく → 怒り → -1
```

---

## 👀 分析結果の可視化

本ツールは、単なる判定だけでなく**分析過程を可視化**します。

### 表示内容

* 判定結果（ポジティブ / ネガティブ / 中立）
* **判定スコア**（判定に実際に使う値 = 合計 ÷ √ヒット数。±しきい値を超えると判定）
* 合計スコア・ヒット数
* **ヒット単語一覧（カテゴリ・極性・変換付き）**
* **カテゴリ別スコア（感情の内訳）**

---

### 🧾 表示例（v0.4.0、入力「とても嬉しくない」）

```
判定: ネガティブ
判定スコア: -1.50（±0.5 を超えると判定）
合計: -1.50 ÷ √ヒット数 1

ヒット単語:
嬉し（喜び / 1 → -1 否定 ×1.5 = -1.50）

カテゴリ別スコア:
喜び: -1.5
```

👉 「なぜそうなったか」だけでなく、
👉 **「どう変換されたか（否定・強調）」まで分かる**

---

## 📁 ディレクトリ構成

```
project/
 ├── index.html          # Vue UI + スタイル
 ├── app.js              # Vueアプリ本体
 ├── ui/
 │    └── labels.js      # 判定ラベル → 表示名・色の対応
 ├── engine/
 │    ├── analyzer.js    # 感情分析ロジック
 │    └── evaluator.js   # 3クラス評価（混同行列・F1）
 ├── data/
 │    ├── config.json    # 感情辞書
 │    ├── testset.json   # 開発用テストセット
 │    └── holdout.json   # ホールドアウト（辞書調整に使わない）
 ├── scripts/
 │    └── eval.js        # コマンドラインでの評価
 ├── tests/              # 回帰テスト（node:test）
 ├── pseudo-api/         # 擬似API
 │    ├── index.html
 │    └── api.js
 ├── package.json        # npm test / npm run eval 用（依存なし）
 ├── README.md
 └── LICENSE
```

---

## ⚙️ 動作方法

### 方法①（推奨）

ローカルサーバを起動：

```bash
python -m http.server
```

ブラウザで：

```
http://localhost:8000
```

---

### 方法②

GitHub Pagesを利用（公開版）：
👉 https://bowo-prasetyo.github.io/japanese-sentiment-analyzer/#/

---

## 🖥️ 使い方

1. テキストを入力
2. 「分析」ボタンをクリック
3. 結果・スコア・ヒット単語・カテゴリ別スコアを確認

---

## 📊 評価（精度の測り方）

positive / negative / neutral の **3クラス分類**として評価します。

* **代表指標: Macro-F1**（3クラスのF1の平均。クラスの偏りに強い）
* Accuracy、クラス別 Precision / Recall / F1
* 3×3 の混同行列（行: 正解 / 列: 予測）

### テストセットは2種類

| ファイル | 用途 |
| --- | --- |
| `data/testset.json` | 開発用。誤判定を見て辞書を調整してよい |
| `data/holdout.json` | **ホールドアウト。これを見て辞書を調整しない** |

開発用セットは辞書に合わせて作られているため、スコアが高く出やすくなります。
実際の文章での精度の目安は **ホールドアウトの Macro-F1** です。
ホールドアウトの誤判定を直したくなったら、その文を開発用セットへ移し、
ホールドアウトには新しい文を補充してください。

### 現在のスコア（v0.4.0）

| セット | Macro-F1 | Accuracy |
| --- | --- | --- |
| 開発用（156件） | 94.2% | 94.2% |
| ホールドアウト（60件） | 44.0% | 45.0% |

ホールドアウトの誤判定の多くは「ヒットなし」（辞書にない語彙）です。

### 実行方法

ブラウザ: 「テスト評価」ボタンでセットを選んで実行。

コマンドライン（Node.js 22 以上、依存パッケージなし）:

```bash
npm run eval              # 両セットの指標
npm run eval -- --errors  # 誤判定の一覧も表示
npm test                  # 回帰テスト
```

---

## 🔌 Pseudo API（擬似API）

ブラウザのみで動作する**擬似API**を提供しています。

---

### 📍 エンドポイント（擬似）

```
https://bowo-prasetyo.github.io/japanese-sentiment-analyzer/pseudo-api/?text=今日は嬉しい
```

---

### 📤 レスポンス例

```json
{
  "result": "positive",
  "score": 1,
  "normalizedScore": 1,
  "threshold": 0.5,
  "hits": 1,
  "matchedWords": [
    { "word": "嬉し", "category": "喜び", "base": 1, "polarity": 1, "negated": false, "multiplier": 1 }
  ],
  "categoryScore": { "喜び": 1 },
  "debugLabel": "neutral"
}
```

---

### ⚙️ 仕組み

* 静的HTMLをロード
* JavaScriptが解析を実行
* JSONを画面に出力

```
URL → HTML → JS実行 → JSON表示
```

---

### ⚠️ 注意事項

Pseudo APIは**本物のAPIではありません**：

| 項目           | Pseudo API      | 本物API            |
| ------------ | --------------- | ---------------- |
| レスポンス        | HTML（JSでJSON表示） | JSON             |
| Content-Type | text/html       | application/json |
| curl対応       | ❌               | ✔                |
| JS実行         | 必須              | 不要               |

---

### 🚫 制限

* POST不可
* URL長制限あり
* JS実行必須

---

### 🧪 利用例

```javascript
const result = await page.evaluate(() => document.body.textContent);
const json = JSON.parse(result);
```

---

## 🧩 辞書の構造（config.json）

```json
{
  "groups": { ... },

  "polarity": {
    "喜び": 1,
    "怒り": -1
  },

  "words": {
    "喜び": ["嬉し", "最高"],
    "怒り": ["ムカつ"]
  },

  "negations": ["ない", "なく", "なかった", "ません", "ぬ", "ず"],

  "negationBoundaries": ["て", "で", "、", "。"],
  "negationBridges": ["ではな", "ていな"],
  "negationWindow": 8,

  "threshold": 0.5,

  "wordExclusions": {
    "神": ["精神", "神経"]
  },

  "intensifiers": {
    "とても": 1.5,
    "めっちゃ": 2
  }
}
```

---

## 🔧 カスタマイズ

### 単語追加

```json
"喜び": ["神", "神すぎる"]
```

---

### 否定語追加

```json
"negations": ["ない", "なかった", "ません"]
```

---

### 誤ヒットの除外

短い語が別の語の一部としてヒットする場合（例：「精神」の中の「神」）は、
`wordExclusions` に除外する複合語を追加します。

```json
"wordExclusions": {
  "神": ["精神", "神経"]
}
```

---

### 強調語追加

```json
"intensifiers": {
  "超": 2,
  "かなり": 1.3
}
```

---

## 🧪 現在の仕様

* 部分一致（`text.includes()`）
* 語幹ベース検出（例：嬉し → 嬉しい）
* 否定表現検出（後方ウィンドウ + includes）
  * スコープは**最も近い**境界（て・で・、など）で切る
  * ただし「ではない」「ていない」などのブリッジでは切らない（`negationBridges`）
* 除外複合語による誤ヒット防止（`wordExclusions`）
* 強調語検出（前方ウィンドウ）
* 判定スコア（合計 ÷ √ヒット数）がしきい値（`threshold`）を超えるかで判定
* ヒット単語の可視化
* カテゴリ別スコア集計

---

## ⚠️ 制限事項

* 形態素解析なし
* 二重否定（例：嬉しくないわけではない → ネガティブと判定される）未対応
* 文脈理解なし
* 多義語・重複ヒットあり
* 強調スコープの曖昧性あり

---

## 🚀 今後の改善

* 否定スコープ改善（高度化）
* 弱化表現対応（少し、ちょっと）
* グラフ可視化
* API化（サーバレス）
* 精度改善（重複・優先度制御）

---

## 📜 ライセンス

MIT License

---

## 🙌 作者

Bowo Prasetyo

---

## 🙌 支援

[ChatGPT](https://chatgpt.com/)
