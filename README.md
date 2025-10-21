# bunlint | テキスト変換スタジオ

Next.js 14（App Router）と Tailwind CSS を用いたテキスト変換ツールです。句読点スタイルの統一や文字数カウントをリアルタイムで行えるエディタを提供し、今後は Gemini API や Neon (PostgreSQL) と連携して語尾変換・履歴管理機能を拡充していきます。

## セットアップ

```bash
bun install
bun run dev   # 開発サーバーを起動
bun test      # Bun 製ユニットテストを実行
bun run lint  # Next.js ESLint を実行
```

Tailwind CSS の設定ファイルは `tailwind.config.ts` に配置しており、`app/globals.css` でベーススタイルを読み込んでいます。

`.env.local` に Gemini API キーを設定すると語尾変換機能が利用可能になります。

```bash
echo "GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env.local
```

## 実装済みの主な機能

- **テキスト統計 (`lib/text.ts`)**
  - 文字数（結合文字含む）・単語数・文数を算出。
  - テストは `tests/text.test.ts` にてカバレッジを確保。
- **句読点変換 (`lib/punctuation.ts`)**
  - 和文スタイル（、。）と学術スタイル（，．）を双方向に変換。
  - テストは `tests/punctuation.test.ts` を参照。
- **語尾変換（Gemini API, `lib/gemini.ts`, `app/api/transform/route.ts`）**
  - Google Gemini API を呼び出し、指定した語尾スタイルへ自動変換。
  - `TextEditor` から API を呼び出し、整形後のテキストを即時反映。
- **App Router ベースの UI (`app/page.tsx`, `components/*`)**
  - `TextEditor` コンポーネントで入力と統計表示、句読点トグルを統合。
  - `TransformationControls` や `StatsPanel` を分離し、将来の Gemini 連携に備えた設計。
  - `HistoryList` コンポーネントを用意し、Neon からのデータ表示を受け入れる準備を整備。

## 今後の拡張

- Neon (PostgreSQL) との接続および履歴 CRUD の実装。
- UI の細かなアクセシビリティ改善やトースト表示の導入。
- `plans.md` のチェックリストに沿った残タスクの消化。

進捗の詳細やタスクの優先度は `plans.md` を参照してください。
