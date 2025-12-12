# Bun Checker

Next.js 16 と Tailwind CSS で構築された、日本語テキストの整形・推敲支援ツールです。

## 主な機能

- **句読点の統一**: 「、。」「，．」「, .」をワンクリックで変換します。
- **文字数カウント**: 文字数、行数、原稿用紙換算などをリアルタイムで表示します。
- **AI 語尾調整**: Gemini API を使用し、文体を「です・ます」「だ・である」に統一したり、自然な表現（Humanize）に整えたりします。
- **AI テキスト判定**: 文章が AI によって生成された可能性を判定します。

## セットアップ

```bash
npm install
npm run dev
```

`.env.local` に Gemini API キーを設定することで、AI 機能が利用可能になります。

```bash
GEMINI_API_KEY=your_api_key_here
```

AI 判定機能で OpenRouter を利用する場合は、以下の環境変数も追加してください。モデル名はコードで固定されており、一次判定に
`google/gemini-2.0-flash-exp:free`、再検証に `amazon/nova-2-lite-v1:free` を使用します。OpenRouter のダッシュボード側で
これらのモデルが利用可能か、クォータや許可設定を確認してください。

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
```

コード上の動作は次の通りです。

- `OPENROUTER_API_KEY` が設定されていれば、AI 判定は OpenRouter 経由で上記 2 モデルを固定で呼び出します。
- OpenRouter 呼び出しで失敗し、かつ `GEMINI_API_KEY` も設定されている場合は Gemini API に自動でフォールバックします。
- どちらのキーも未設定の場合は AI 判定を実行せずエラーになります。

そのため、OpenRouter で 2 つのモデルが利用可能な状態で `OPENROUTER_API_KEY` をセットしていれば、追加のコード変更なく AI 判定機能を利用できます。
