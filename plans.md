# 開発計画：テキスト変換・語尾調整サービス

## 1. プロジェクト概要

- Next.js 14（App Router）をベースとしたWebアプリケーションをVercelにデプロイする。
- テキスト入力に対して以下の機能を提供する：
  - 文字数・単語数のカウント表示。
  - 句読点を「，」「．」スタイルへ一括変換するトグル機能。
  - Gemini APIを用いた語尾変換（だ・である調／です・ます調／カジュアルなど）の自動処理。
- ユーザー操作履歴や設定はNeon（PostgreSQL）に保存し、後日分析やプリセット呼び出しに利用できるようにする。
- UIはできる限りシンプルに保ちつつ、UXを最大限に高めることを設計指針とする。

## 2. 必要なサービス・環境準備

1. **Google AI StudioでのGemini APIキー取得**
   - `.env`に`GEMINI_API_KEY`を設定。
2. **NeonでのPostgreSQLプロジェクト作成**
   - 接続情報を`.env`に`DATABASE_URL`として保存。
3. **Vercelプロジェクト設定**
   - 環境変数（`GEMINI_API_KEY`、`DATABASE_URL`）をVercelのDashboardで設定。

## 3. Next.jsアプリ構成

- ディレクトリ：`app/`を利用。以下のページ・コンポーネントを想定。
  - `app/page.tsx`：メインエディタページ。
  - `components/TextEditor.tsx`：入力と結果表示を統合したコンポーネント（実装済み）。
  - `components/StatsPanel.tsx`：文字数/単語数/文章数などの統計情報表示（実装済み）。
  - `components/TransformationControls.tsx`：句読点変換や語尾調整のトグル・セレクト（UIのみ実装済み）。
  - `components/HistoryList.tsx`：Neonから取得した履歴の表示（UIのみ実装済み）。
  - `lib/gemini.ts`：Gemini APIクライアント。
  - `lib/db.ts`：Neon (PostgreSQL) 接続ロジック。
  - `app/api/transform/route.ts`：語尾変換APIルート。
  - `app/api/history/route.ts`：履歴のCRUD API。
- UI：Tailwind CSSを導入し、Vercelでのビルドに合わせた設定を`tailwind.config.ts`に記載。

## 4. 機能仕様

### 4.1 文字数カウント

- 入力テキストが変化するたびに即時更新。
- 文字数、単語数（スペース区切り）、文数（「。」「．」「!」「?」等で分割）を表示。

### 4.2 句読点変換

- 入力テキストの句読点をリアルタイムに`、`→`，`、`。`→`．`へ変換するトグルスイッチ。
- 逆変換（`，`→`、`、`．`→`。`）にも対応し、ユーザーが元に戻せるようにする。
- 入力の最終状態は常にエディタに反映。

### 4.3 語尾調整（Gemini API）

- ユーザーが選択したスタイル（例：だ・である調／です・ます調／カジュアル）に基づいて、Gemini APIにプロンプトを生成。
- APIレスポンスを整形し、エディタに反映。
- 過度な変換を防ぐため、元テキストとのDiffを表示するか、変更箇所をハイライトする機能を検討。
- APIコールは`use server`関数またはAPIルートで実装し、フロントから呼び出す。

### 4.4 履歴管理（Neon）

- テーブル例：`transform_history`
  - `id` (UUID, primary key)
  - `input_text` (text)
  - `output_text` (text)
  - `style` (text)
  - `punctuation_mode` (enum)
  - `created_at` (timestamp with time zone, default now)
- ユーザー操作ごとに履歴を保存し、最新10件程度を画面に表示。
- 将来的なユーザー認証を考慮し、`user_id`カラムを追加できるようスキーマを設計。

## 5. 実装ステップ

1. Next.jsプロジェクト作成と基本設定（完了）
   - `npx create-next-app@latest`で初期化。
   - TypeScript, ESLint, Tailwindを有効化。
   - Vercelデプロイ設定確認。
2. UIレイアウトと状態管理（初期版完了）
   - `TextEditor`コンポーネントを実装し、`useState`で入力管理。
   - `StatsPanel`と`TransformationControls`を配置。
3. 文字数カウント・句読点変換ロジック
   - 文字数/単語数計算のユーティリティ作成（`lib/text.ts`、実装済み）。
   - 句読点変換ロジックを`lib/punctuation.ts`に分離し、ユニットテストを作成（実装済み）。
4. Gemini API連携
   - `lib/gemini.ts`にAPIクライアント実装。
   - `app/api/transform/route.ts`でPOSTリクエストに応答。
   - フロントから`fetch`で呼び出し結果を反映。
5. Neon接続と履歴API
   - `lib/db.ts`でNeonへの接続を設定（`@neondatabase/serverless`など使用）。
   - PrismaまたはDrizzleを導入してスキーマ管理し、マイグレーションを実行。
   - `app/api/history/route.ts`で履歴取得・登録を実装。
6. UI改善とエラーハンドリング
   - APIエラー時のトースト表示、ローディング状態管理。
   - 語尾調整結果のDiff表示。
7. テスト
   - 単体テスト：文字数計算・句読点変換ロジック。
   - E2Eテスト（Playwright）で主要フローを確認。

## 6. デプロイと運用

- Vercelへのデプロイ後、Neonの接続制限やGemini APIのクオータを監視。
- エラーログはVercelのLog DrainsやSentry導入を検討。
- 将来的にはユーザー認証（NextAuth.js）追加や、変換スタイルのカスタマイズ機能を拡張予定。

## 7. 実装進捗チェックリスト

- [x] Next.jsプロジェクトの初期化と基本設定
- [x] 文字数・単語数カウント機能の実装
- [x] 句読点変換トグルの実装
- [ ] Gemini APIによる語尾変換機能の実装
- [ ] Neonを用いた履歴管理機能の実装
- [ ] シンプルなUI構成とUX最適化の完了
- [ ] 単体テスト・E2Eテストの整備
- [ ] Vercelへのデプロイと環境変数設定の確認
- [ ] 運用監視とエラーログ収集体制の確立

> チェックボックスは各機能を実装したタイミングで更新し、進捗管理に活用する。
> 各チェックボックスを完了にした際には必ず`npm run build`を実行し、ビルドエラーが発生しないことを確認する。

## 8. 開発プロセス上の注意点

- テストは可能な限り充実させる。主要なユーティリティの単体テスト、APIルートの統合テスト、UI操作のE2Eテストを計画し、将来的に回帰を防ぐ。
- コミットは細かく分割し、必ず日本語で簡潔なメッセージを付ける。例：「文字数計算のテスト追加」「句読点変換ロジックを調整」など。
- `.env`やVercel上の環境変数設定はユーザー側で実施するため、リポジトリではダミーやサンプル値を保持しない。必要な変数はドキュメントや残作業リストで周知する。
- 作業完了時には、ユーザーが残りの設定作業を把握できるよう、やるべき事項をまとめたMarkdownファイルを作成・更新する。
