import { writingStylePresets, type WritingStyle } from "@/lib/gemini";
import type { PunctuationMode } from "@/lib/punctuation";

export type HistoryEntry = {
  id: string;
  inputText: string;
  outputText: string;
  writingStyle: WritingStyle;
  writingStyleLabel?: string;
  punctuationMode: PunctuationMode;
  createdAt: string;
};

type HistoryListProps = {
  entries: HistoryEntry[];
  isLoading?: boolean;
};

export function HistoryList({ entries, isLoading = false }: HistoryListProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">変換履歴</h3>
        <p className="mt-2 text-sm text-slate-500">読み込み中です...</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-200 bg-slate-100/60 p-4 text-sm text-slate-500">
        <h3 className="text-sm font-semibold text-slate-600">変換履歴</h3>
        <p className="mt-2">
          まだ変換履歴がありません。Gemini API
          で語尾変換を実行すると、ここに最新10件の結果が保存されます。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">変換履歴</h3>
      <ul className="space-y-3">
        {entries.map((entry) => {
          const preset = writingStylePresets[entry.writingStyle];
          const writingStyleLabel =
            entry.writingStyleLabel ?? preset?.label ?? entry.writingStyle;

          return (
            <li
              key={entry.id}
              className="rounded-md border border-slate-200 p-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(entry.createdAt).toLocaleString("ja-JP")}</span>
                <span>
                  {writingStyleLabel} /{" "}
                  {entry.punctuationMode === "academic" ? "学術" : "和文"}
                </span>
              </div>
              <p className="mt-2 max-h-24 overflow-hidden text-sm text-slate-600">
                {entry.outputText || entry.inputText}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
