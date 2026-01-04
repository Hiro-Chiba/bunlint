# Bun Checker

日本語テキストの整形・推敲をサポートする Next.js + Tailwind CSS アプリです。

## できること

- 句読点の一括変換（「、。」「，．」「, .」）
- 文字数・行数・原稿用紙換算のカウント
- AI で文体を統一（です・ます / だ・である）や自然な表現に調整
- AI テキスト判定

## セットアップ

```bash
npm install
npm run dev
```

### 環境変数

AI 機能を使うには `.env.local` に Gemini API キーを設定します。

```bash
GEMINI_API_KEY=your_api_key_here
```

AI 判定を OpenRouter で行う場合は、次も設定してください。使用モデルは固定です。

- 一次判定: `google/gemini-2.0-flash-exp:free`
- 再検証: `amazon/nova-2-lite-v1:free`

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
```

### AI 判定の動き

- `OPENROUTER_API_KEY` があれば OpenRouter を使用
- OpenRouter 失敗時、`GEMINI_API_KEY` があれば Gemini に自動フォールバック
- どちらも未設定なら AI 判定は実行不可
