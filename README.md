# bunlint | 日本語テキスト整形スタジオ

bunlint は Next.js 14 と Tailwind CSS で作った日本語テキスト変換ツールです。句読点スタイルの統一、文字数カウント、AI による語尾調整をブラウザー上でまとめて行えます。Gemini API と連携した変換結果のローカル保存にも対応しています。

## セットアップ

```bash
npm install
npm run dev    # 開発サーバーを起動
npm test       # Node.js のテストランナーでユニットテストを実行
npm run lint   # Next.js の ESLint を実行
npm run build  # 本番ビルドを作成
```

`npm test` は TypeScript で書いた整形ユーティリティを Node.js のテストランナーから直接実行します。整形やコードスタイルの確認には `npm run format`（Prettier のチェック）も使えます。

Tailwind CSS の設定は `tailwind.config.ts` と `app/globals.css` にまとめています。

`.env.local` に Gemini API キーを設定すると語尾変換を試せます。

```bash
echo "GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env.local
echo "GEMINI_MODEL=gemini-2.0-flash" >> .env.local         # 省略可。任意のモデル名
echo "GEMINI_API_VERSION=v1" >> .env.local                 # 省略可。複数指定はカンマ区切り
```

未設定の場合は `gemini-2.0-flash-lite` と `v1beta` / `v1` へ自動でフォールバックします。

## 主な機能

- **テキスト統計 (`lib/text.ts`)**：文字数（結合文字含む）・内容語数・文数を算出。
- **句読点変換 (`lib/punctuation.ts`)**：和文（、。）、学術（，．）、欧文（,.）を相互に変換。
- **語尾変換 (`lib/gemini.ts`, `app/api/transform/route.ts`)**：Gemini API で指定した文体に整形し、`TextEditor` から即時反映。
- **UI (`app/page.tsx`, `components/*`)**：App Router ベース。`HistoryList` はブラウザーに最新10件を保存し再利用できます。

