# Japanese Rule-Based Sentiment Analyzer

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
* スコア
* ヒット数
* **ヒット単語一覧（カテゴリ・極性付き）**

例：

```
嬉し（喜び / +1）
不安（不安 / -0.7）
```

👉 なぜその結果になったかが分かるため、辞書改善やデバッグが容易になります。

---

## 📁 ディレクトリ構成

```
project/
 ├── index.html         # Vue UI + スタイル
 ├── app.js             # Vueアプリ本体
 ├── engine/
 │    └── analyzer.js   # 感情分析ロジック
 ├── data/
 │    └── config.json   # 感情辞書
 ├── pseudo-api/        # 擬似API
 │    ├── index.html
 │    └── api.js
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
3. 結果・スコア・ヒット単語を確認

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
{"result":"ポジティブ","score":1,"hits":1}
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

### スコア調整

```json
"ストレス": -0.5
```

---

## 🧪 現在の仕様

* 部分一致（`text.includes()`）
* 語幹ベース検出（例：嬉し → 嬉しい）
* スコア合計による判定
* ヒット単語の可視化

---

## ⚠️ 制限事項

* 形態素解析なし
* 否定表現未対応（例：嬉しくない）
* 文脈理解なし
* 多義語・重複ヒットあり

---

## 🚀 今後の改善

* 否定表現対応
* カテゴリ別スコア
* グラフ可視化
* 強調語対応
* API化（サーバレス）

---

## 📜 ライセンス

MIT License

---

## 🙌 作者

Bowo Prasetyo
