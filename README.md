# bunlint | テキスト変換スタジオ

Next.js 14（App Router）と Tailwind CSS を用いたテキスト変換ツールです。句読点スタイルの統一や文字数カウントをリアルタイムで行えるエディタを提供し、今後は Gemini API や Neon (PostgreSQL) と連携して語尾変換・履歴管理機能を拡充していきます。

## セットアップ

```bash
npm install
npm run dev    # 開発サーバーを起動
npm test       # Node.js のテストランナーでユニットテストを実行
npm run lint   # Next.js の ESLint を実行
npm run build  # 本番ビルドを作成
```

整形に関するユーティリティはすべて TypeScript で記述しているため、`npm test` ではカスタムローダーを `--import` で登録し、Node.js 標準のテストランナーから直接実行しています。整形やコードスタイルの確認には `npm run format`（Prettier のチェック）も利用できます。

Tailwind CSS の設定ファイルは `tailwind.config.ts` に配置しており、`app/globals.css` でベーススタイルを読み込んでいます。

`.env.local` に Gemini API キーを設定すると語尾変換機能が利用可能になります。

```bash
echo "GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env.local
```

Gemini モデルや API バージョンを切り替える必要がある場合は、以下の環境変数で上書きできます（未設定時は `gemini-2.0-flash-lite` と `v1beta` → `v1` の順に自動フォールバックします）。

```bash
echo "GEMINI_MODEL=gemini-2.0-flash" >> .env.local         # 任意のモデル名
echo "GEMINI_API_VERSION=v1" >> .env.local                 # 複数指定する場合はカンマ区切り
```

## 実装済みの主な機能

- **テキスト統計 (`lib/text.ts`)**
  - 文字数（結合文字含む）・単語数・文数を算出。
  - テストは `tests/text.test.ts` にてカバレッジを確保。
- **句読点変換 (`lib/punctuation.ts`)**
  - 和文スタイル（、。）、学術スタイル（，．）、欧文スタイル（,.）を相互に変換。
  - テストは `tests/punctuation.test.ts` を参照。
- **語尾変換（Gemini API, `lib/gemini.ts`, `app/api/transform/route.ts`）**
  - Google Gemini 2.0 Flash-Lite API（`gemini-2.0-flash-lite`）を呼び出し、指定した語尾スタイルへ自動変換。
  - `TextEditor` から API を呼び出し、整形後のテキストを即時反映。
- **App Router ベースの UI (`app/page.tsx`, `components/*`)**
  - `TextEditor` コンポーネントで入力と統計表示、句読点トグルを統合。
  - `TransformationControls` や `StatsPanel` を分離し、将来の Gemini 連携に備えた設計。
  - `HistoryList` ではブラウザーの `localStorage` に直近10件の変換履歴を保存し、再読み込み後も参照できます。

## 今後の拡張

- Neon (PostgreSQL) との接続および履歴 CRUD の実装。
- UI の細かなアクセシビリティ改善やトースト表示の導入。
- `plans.md` のチェックリストに沿った残タスクの消化。

進捗の詳細やタスクの優先度は `plans.md` を参照してください。
