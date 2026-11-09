# 開発への参加

Tenbin を手元で動かす方法、テスト、CI、依存ライブラリの更新、ディレクトリ構成を説明します。
辞書の編集は[辞書のリファレンス](docs/dictionary.md)、精度の測り方は[評価](docs/evaluation.md)を見てください。

## 目次

* [手元で動かす](#手元で動かす)
* [テストと評価](#テストと評価)
* [CI（GitHub Actions）](#cigithub-actions)
* [辞書を改善したとき](#辞書を改善したとき)
* [依存ライブラリの更新](#依存ライブラリの更新)
* [ディレクトリ構成](#ディレクトリ構成)
* [ロゴ](#ロゴ)
* [リリース手順](#リリース手順)
* [今後の改善](#今後の改善)

---

## 手元で動かす

### Web ページ

ページは `fetch` で `data/config.json` を読み込むため、`index.html` をファイルとして直接開いても動きません。
リポジトリのフォルダでローカルサーバを起動します。

```bash
python3 -m http.server
```

ブラウザで http://localhost:8000 を開きます（Windows では `python3` の代わりに `py` を使います）。
ビルドの手順はありません。ファイルを保存してページを再読み込みすれば反映されます。

### Node.js（テスト・評価）

Node.js 22 以上が必要です。最初に一度、依存パッケージ（kuromoji。形態素解析に使う）をインストールします。

```bash
npm ci
```

---

## テストと評価

| コマンド | 内容 |
| --- | --- |
| `npm test` | 回帰テスト（`node:test`） |
| `npm run eval` | 開発用セットとホールドアウトの指標。オプションは[評価](docs/evaluation.md#実行方法)を参照 |
| `npm run bench` | 固定ブラインドベンチマーク（集計だけ） |
| `npm run gates` | 辞書を変えたときのゲート（[辞書のリファレンス](docs/dictionary.md#語彙の追加手順ゲート)） |
| `npm run check:cdn` | `vendor/` のファイルと kuromoji が配布元と同じかを確かめる（ネットワークが必要） |

`docs/pseudo-api.md` のレスポンス例は、`tests/readme.test.js` が実際の出力と一致するかを確かめています。
判定のしくみや辞書を変えて出力が変わったら、レスポンス例も更新してください。

---

## CI（GitHub Actions）

Pull Request と `main` への push で、次を実行します（`.github/workflows/ci.yml`）。

| ステップ | 内容 |
| --- | --- |
| `npm ci` | 依存パッケージ（kuromoji）のインストール |
| `npm test` | 回帰テスト（否定の処理・評価の指標・表示ラベル・`vendor/` のファイルと SRI の一致 など） |
| `npm run eval -- --check` | 開発用セット・ホールドアウトの Macro-F1 が `data/eval-baseline.json` を下回ったら失敗 |
| `npm run check:cdn` | `vendor/` のファイルの配布元（`data-upstream`）と kuromoji を実際に取得し、SRI のハッシュと一致するか確かめる |
| `npm run bench -- --summary` | 固定ブラインドベンチマークのスコアをジョブサマリーに**報告**する（スコアでは失敗しない。ファイルが改変されていたら失敗） |

---

## 辞書を改善したとき

精度が上がると、CI に「改善しています」と表示されます。ベースラインを更新してコミットしてください。

```bash
npm run eval -- --update-baseline
```

精度が下がると CI は失敗します。意図して下げる場合（テストセットの修正など）も、
理由を Pull Request に書いたうえで、同じコマンドでベースラインを更新します。

バージョンを上げたら、ベンチマークのスコアを記録します。

```bash
npm run bench -- --record
```

---

## 依存ライブラリの更新

Vue と Vue Router は、配布元と**同一のファイル**を `vendor/<パッケージ>@<バージョン>/` に置いて読み込みます
（CDN が遮断・停止していてもページが動くように）。
`index.html` の `<script>` には、`integrity`（SRI のハッシュ）と配布元の URL（`data-upstream`）を書きます。

### 手順

1. 新しいバージョンのファイルを取得して、`vendor/` に置きます（例は Vue。Vue Router も同じ）。

   ```bash
   npm pack vue@<version> && tar xzf vue-<version>.tgz
   ```

   ```bash
   mkdir -p vendor/vue@<version> && cp package/dist/vue.global.prod.js package/LICENSE vendor/vue@<version>/
   ```

2. SRI のハッシュを計算します。

   ```bash
   echo "sha384-$(openssl dgst -sha384 -binary vendor/vue@<version>/vue.global.prod.js | openssl base64 -A)"
   ```

3. `index.html` の `src`・`integrity`・`data-upstream` を書き換えます。
4. 古いバージョンのフォルダと、取得に使った `package/`・`.tgz` を削除します。
5. `THIRD_PARTY_NOTICES.md` のバージョンを更新します。
6. `npm test` と `npm run check:cdn` で確かめます。

### 確かめられること

* `npm test` は、`vendor/` のファイルのハッシュが `integrity` と一致するかを確かめます（改行コードの変換などで中身が変わると失敗します）。
* CI の `check:cdn` は、配布元（`data-upstream`）のファイルが同じハッシュか、つまり `vendor/` のファイルが配布元と同一かを確かめます。
* `integrity` が間違っていると、ブラウザはスクリプトを読み込まず、ページは「画面を読み込めませんでした」と表示します。

---

## ディレクトリ構成

```
project/
 ├── index.html          # Vue の画面 + スタイル
 ├── app.js              # Vue アプリ本体（1件ずつ #/ ・まとめて分析 #/bulk ・開発者向け #/dev）
 ├── assets/             # ロゴ・ファビコン
 ├── vendor/             # Vue・Vue Router（配布元と同一のファイル＋ライセンス。SRI で固定）
 ├── ui/
 │    ├── labels.js      # 判定 → 表示名・色の対応（判定できません を含む）
 │    ├── userDictionary.js # ユーザー辞書（検証・統合・書き出し／読み込み・保存）
 │    ├── bulk.js        # まとめて分析（分割・CSV・文字コード・集計・CSV の書き出し）
 │    ├── breakdown.js   # カテゴリ別の点数を観点・感情に分けて並べる
 │    ├── visual.js      # メーター・文中の語の印
 │    └── interaction.js # キーボード操作などの画面の動き
 ├── engine/
 │    ├── analyzer.js    # 感情分析のロジック
 │    └── evaluator.js   # 3クラスの評価（混同行列・F1）
 ├── data/
 │    ├── config.json    # 組み込み辞書
 │    ├── testset.json   # 開発用セット
 │    ├── holdout.json   # ホールドアウト（辞書の調整に使わない）
 │    ├── eval-baseline.json # CI で守る Macro-F1 の下限
 │    ├── kuromoji-dict.json # 形態素解析の辞書の URL とハッシュ
 │    └── benchmark/     # 固定ブラインドベンチマーク（b1.json・manifest・履歴）
 ├── scripts/
 │    ├── eval.js        # コマンドラインでの評価
 │    ├── gates.js       # 辞書を変えたときのゲート
 │    ├── benchmark.js   # 固定ブラインドベンチマークの評価（集計のみ）
 │    ├── benchmark-lib.js # ベンチマークの読み込みとハッシュの検証
 │    ├── check-cdn.js   # 配布元（CDN）のファイルの SRI 検証（CI 用）
 │    ├── cdn-scripts.js # index.html の外部スクリプトの抽出
 │    └── tokenizer.js   # Node 用の kuromoji tokenizer
 ├── pseudo-api/         # 擬似API（index.html・api.js）
 ├── tests/              # 回帰テスト（node:test）
 ├── docs/               # ユーザーガイド・用語集・辞書・評価・擬似API の文書と画像
 ├── .github/workflows/
 │    └── ci.yml         # CI（テスト・精度のチェック・CDN の検証）
 ├── package.json        # npm のスクリプト（依存: kuromoji）
 ├── CONTRIBUTING.md     # この文書
 ├── THIRD_PARTY_NOTICES.md # Vue・Vue Router・kuromoji.js・IPADIC のライセンス表示
 ├── README.md
 └── LICENSE
```

---

## ロゴ

天秤の両皿が**吹き出し**（左＝ポジティブの緑、右＝ネガティブの赤）になっています。
竿は水平で、ことばを公平に、重さが見える形で量ることを表します。色は画面の判定の表示（`.positive` / `.negative`）と同じです。

| ファイル | 用途 |
| --- | --- |
| `assets/mark.svg` | マーク単体（画面のヘッダー） |
| `assets/logo.svg` | マーク＋ロゴタイプ（README など。文字はシステムフォントで描画） |
| `assets/favicon.svg` | ファビコン（ダークモードでは支柱が明るい色に変わる） |
| `assets/favicon-32.png` | SVG のファビコンに対応しないブラウザ用 |
| `assets/apple-touch-icon.png` | ホーム画面用（180×180、白背景） |

---

## リリース手順

公開リリースは GitHub Release として出します。最初の公開リリースは v0.16.0 です。

1. **PR で準備する**
   * `package.json` の `version` を上げ、`npm install --package-lock-only` で `package-lock.json` も合わせる
   * [CHANGELOG.md](CHANGELOG.md) の `[Unreleased]` の内容を新しいバージョンの見出しの下に移し、日付と比較リンクを足す
   * エンジンか辞書を変えた場合は、`npm run bench -- --record` でベンチマークの記録を足す（[評価](docs/evaluation.md#記録されたスコア)）
   * リリースノートを `docs/releases/vX.Y.Z.md` に書く（GitHub Release に貼るため、リンクは `blob/vX.Y.Z/...` の絶対 URL にする）
2. **PR をマージし、CI が緑であることを確かめる**
3. **マージコミットにタグを付けて push する**

   ```bash
   git tag -a vX.Y.Z -m "Tenbin vX.Y.Z"
   ```

   ```bash
   git push origin vX.Y.Z
   ```

4. **GitHub Release を作る**: リポジトリの Releases →「Draft a new release」で `vX.Y.Z` タグを選び、
   `docs/releases/vX.Y.Z.md` の本文を貼り付けて公開する
5. **公開版を確かめる**: GitHub Pages の画面に新しい版の変更が出ていること

バージョン番号は [セマンティック バージョニング](https://semver.org/lang/ja/) に従います。
0.x の間は辞書の形式や判定結果が変わることがあり、その方針はリリースノートの「互換性」に書きます。

---

## 今後の改善

* 否定の範囲の改善（高度化）
* 弱める表現（少し・ちょっと）への対応
* グラフでの可視化
* API 化（サーバレス）
* 頻度の副詞（よく・しょっちゅう・たびたび）＋不具合の動詞（止まる・固まる・落ちる）の組み合わせ
* 人が書いたブラインドベンチマーク（b2）の追加
