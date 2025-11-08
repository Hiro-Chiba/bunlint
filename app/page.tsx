import { TextEditor } from "@/components/TextEditor";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">bunlint</h1>
      </header>
      <TextEditor />
    </main>
  );
}
