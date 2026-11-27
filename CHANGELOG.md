# 変更履歴

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に沿い、
バージョン番号は [セマンティック バージョニング](https://semver.org/lang/ja/) に従います。

* **v0.1.0〜v0.3.0** は 2026年5月に GitHub Release として公開しました。
* **v0.4.0〜v0.15.0** は開発中の版で、タグやリリースはありません。これらの変更はすべて **v0.16.0** のリリースに含まれます。
  v0.16.0 は v0.3.0 以来のリリースで、**Tenbin（天秤）** としての最初のリリースです。
* 各バージョンには、そのバージョン番号に上げた PR **までに** マージされた変更をまとめています
  （たとえば #14・#15 は `package.json` が 0.14.0 のままマージされたため、それを含む最初の版である 0.15.0 に記載）。
* 精度の数値の測り方と、バージョンごとの記録は [評価](docs/evaluation.md) を見てください。
* 0.x の間の互換性の方針は [リリースノート](docs/releases/v0.16.0.md#互換性0x-の間の方針) にあります。

## [Unreleased]

## [0.16.0] - 2026-11-09

v0.3.0 以来のリリース（v0.4.0〜v0.15.0 の変更をすべて含む）。Tenbin（天秤）としての最初のリリース。
擬似API の出力が v0.3.0 から変わっています（[リリースノート](docs/releases/v0.16.0.md#v030-から使っている場合)）。

### 追加
- **まとめて分析**（`#/bulk`）: 複数のレビューを1件ずつ分析して集計する画面。貼り付け（1行1件・空行区切り）や
  `.txt` / `.csv`（UTF-8・Shift_JIS、最大 5MB・1000件）を読み込み、件数と割合・観点別の良し悪し・よく出た語・
  一覧（絞り込み）・CSV 書き出しを表示します。処理はすべてブラウザの中で行います（[#24])
- ユーザー向けの文書を役割ごとに分割: [ユーザーガイド](docs/user-guide.md)・[用語集](docs/glossary.md)・
  [辞書のリファレンス](docs/dictionary.md)・[評価](docs/evaluation.md)・[擬似API](docs/pseudo-api.md)・
  [開発への参加](CONTRIBUTING.md)（[#25]）

### 修正
- README の誤り（画面の数、依存パッケージの有無、`python3`、スコア表の版の説明）（[#25]）

## [0.15.0] - 2026-11-09

### 追加
- 新しい名前とロゴ **Tenbin（天秤）**（[#15], [#16]）
- 「判定できません」の**理由**を正しく表示（逆接の前の語・数えなかった語・極性 0 の語だけ・語なし）（[#17]）
- ユーザー辞書: 入力中の語を今の文で試した結果の表示、語幹の提案、削除の「元に戻す」（[#18], [#22]）
- 文中の語の強調表示（下線の種類で正負を区別）と、判定スコアのメーター（[#21]）
- 結果が古くなったときの表示、Ctrl/⌘+Enter で分析、スマートフォンで結果までスクロール（[#19]）
- 語彙の拡充（第4弾、約550語）。「壊れにくい」「不誠実」など、これまで逆に判定していた表現も修正（[#23]）
- 指標「ポジティブ・ネガティブの文を判定できた割合」と、ゲート確認のスクリプト `npm run gates`（[#23]）

### 変更
- 形態素解析の切り替えを「詳細設定」に移動（[#22]）
- 色のコントラスト（WCAG AA）、スクリーンリーダー向けの領域と読み上げ（[#20]）
- Vue・Vue Router をリポジトリに同梱（`vendor/`）し、CDN に依存せずに動くように。読み込み中・失敗時の表示も追加（[#17]）
- CI の `actions/checkout`・`actions/setup-node` を v7 に更新（Node.js 20 の非推奨警告を解消）（[#14]）
- ホールドアウトを v9 に入れ替え（[#23]）

### 修正
- 空の入力を「判定できません」として分析しない（[#17]）
- iOS で入力時に画面が拡大される問題、日本語フォント（[#19]）
- ユーザー辞書の読み込み件数の表示（[#20]）
- 擬似API の文書を実際の出力に合わせ、空白だけの入力を拒否（[#22]）

## [0.14.0] - 2026-11-08

### 追加
- 辞書の語が見つからないときは「中立」ではなく **「判定できません」** と表示（[#13]）
- **ユーザー辞書**: 画面から語を追加（ブラウザに保存、JSON で書き出し・読み込み）（[#13]）
- 指標「判定できた割合（coverage）」と「判定できた文での正解率」（[#13]）

## [0.13.0] - 2026-11-08

### 追加
- 形態素解析（kuromoji.js）を任意（オプトイン）で利用可能に。否定の形態素と語の境界を判定に使用（[#12]）

## [0.12.0] - 2026-11-08

### 追加
- 語彙の拡充（第3弾）（[#11]）

### 修正
- 極性 0 の語がヒット数に数えられ、他の語のスコアを薄めていた問題（[#11]）
- 「二度と…ない」のように否定が離れた表現を検出（[#11]）

## [0.11.0] - 2026-11-08

### 変更
- 「説明できる日本語レビュー感情分析」として位置づけを明確化。一般向け画面（`#/`）と開発者向け画面（`#/dev`）を分離（[#10]）

## [0.10.0] - 2026-11-08

### 追加
- 語彙の拡充（第2弾: 結果の描写）（[#9]）
- 辞書の重複を検出するテスト（[#9]）

## [0.9.0] - 2026-11-08

### 追加
- 語彙の拡充（第1弾、約235語）（[#8]）

### 修正
- 否定は最も近い語にだけ効くように（「かゆみが全然治まらない」）（[#8]）

## [0.8.0] - 2026-11-08

### 追加
- 固定ブラインドベンチマーク b1（[#6]）

### 修正
- 「場合は」（条件）と「場合が」（頻度）の区別、副詞の「よく」を数えない（[#7]）

## [0.7.0] - 2026-11-08

### 追加
- 条件・説明の中の語を数えない（「動かない場合は〜」「眠れない夜のための〜」）（[#5]）

## [0.6.0] - 2026-11-08

### 追加
- 否定されたときだけ数える語（「眠れなかった」「効かず」）（[#4]）

## [0.5.0] - 2026-11-08

### 追加
- CI（テスト・精度チェック・CDN の検証）と、Vue のバージョン固定・SRI（[#2]）
- レビュー語彙と最長一致（[#3]）

## [0.4.0] - 2026-11-08

### 追加
- 3クラスの評価（Macro-F1・混同行列）とホールドアウト（[#1]）

### 修正
- 結果の色が常に中立になる問題、「精神」の中の「神」、否定の範囲など（[#1]）

## [0.3.0] - 2026-05-01

### 追加
- 否定表現（「嬉しくない」→ ネガティブ）と強調語（「とても」でスコアを増幅）
- ヒット単語に否定（negated）と強調倍率（multiplier）を表示

## [0.2.0] - 2026-05-01

### 追加
- カテゴリ別スコア（感情の内訳）

## [0.1.0] - 2026-05-01

### 追加
- 最初のリリース: ルールベースの感情分析エンジン、Vue 3 の画面、擬似API

[Unreleased]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/compare/v0.16.0...HEAD
[0.16.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/releases/tag/v0.16.0
[0.15.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/23
[0.14.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/13
[0.13.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/12
[0.12.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/11
[0.11.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/10
[0.10.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/9
[0.9.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/8
[0.8.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/7
[0.7.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/5
[0.6.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/4
[0.5.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/3
[0.4.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/1
[0.3.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/releases/tag/v0.3.0
[0.2.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/releases/tag/v0.2.0
[0.1.0]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/releases/tag/v0.1.0
[#1]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/1
[#2]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/2
[#3]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/3
[#4]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/4
[#5]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/5
[#6]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/6
[#7]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/7
[#8]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/8
[#9]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/9
[#10]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/10
[#11]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/11
[#12]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/12
[#13]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/13
[#14]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/14
[#15]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/15
[#16]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/16
[#17]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/17
[#18]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/18
[#19]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/19
[#20]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/20
[#21]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/21
[#22]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/22
[#23]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/23
[#24]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/24
[#25]: https://github.com/bowo-prasetyo/japanese-sentiment-analyzer/pull/25
