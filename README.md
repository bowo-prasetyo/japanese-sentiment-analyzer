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

## 📁 ディレクトリ構成

```
project/
 ├── index.html         # Vue UI + スタイル
 ├── app.js             # Vueアプリ本体
 ├── engine/
 │    └── analyzer.js   # 感情分析ロジック
 ├── data/
 │    └── config.json   # 感情辞書
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
3. 結果・スコア・ヒット数を確認

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
    "喜び": ["嬉しい", "楽しい"],
    "怒り": ["ムカつく"]
  }
}
```

---

## 🔧 カスタマイズ方法

### 単語追加

```json
"喜び": ["嬉しい", "最高", "神"]
```

---

### 感情追加

```json
"polarity": {
  "感動": 1
}
```

---

### スコア調整

```json
"怒り": -1,
"ストレス": -0.5
```

---

## 🧪 現在の仕様

* 完全一致（`text.includes()`）による単語検出
* スコア合計による極性判定
* ヒット数カウント

---

## ⚠️ 制限事項

* 形態素解析なし（単純文字列一致）
* 否定表現未対応（例：嬉しくない）
* 文脈理解なし
* 多義語の曖昧性あり

---

## 🚀 今後の改善アイデア

* 否定表現対応（〜ない）
* 強調語（とても、めっちゃ）
* ヒット単語表示
* カテゴリ別スコア表示
* グラフ可視化（Chart.js）
* LLMとの比較

---

## 📜 ライセンス

MIT License

---

## 🙌 作者

Bowo Prasetyo

---
