import { TextEditor } from "@/components/TextEditor";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          bunlint
        </p>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          テキスト変換・語尾調整スタジオ
        </h1>
        <p className="max-w-3xl text-base text-slate-600">
          文章の句読点スタイルや語尾のトーンを整え、統計情報をチェックできるエディタです。
          Gemini API を用いた語尾変換と句読点変換に対応しており、Neon による履歴管理は今後追加予定です。
        </p>
      </header>
      <TextEditor />
    </main>
  );
}
