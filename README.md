# bunlint

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
