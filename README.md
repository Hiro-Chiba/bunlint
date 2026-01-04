# Bun Checker

Next.js 16 と Tailwind CSS で作られた、日本語テキストの整形・推敲支援ツールです。

## できること

- 句読点の統一（「、。」「，．」「, .」の変換）
- 文字数・行数・原稿用紙換算のリアルタイム表示
- AI による語尾の統一（です・ます / だ・である）と自然な表現への調整
- AI 生成テキストの判定

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

AI 判定を OpenRouter で動かす場合は、以下も追加してください。
一次判定は `google/gemini-2.0-flash-exp:free`、再検証は `amazon/nova-2-lite-v1:free` を使います。

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
```

### AI 判定の動き

- `OPENROUTER_API_KEY` があれば OpenRouter を使用
- OpenRouter 失敗時、`GEMINI_API_KEY` があれば Gemini に自動フォールバック
- どちらも未設定なら AI 判定は実行不可
