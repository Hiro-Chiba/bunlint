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

export type HistoryRestoreMode = "output" | "input";

type HistoryListProps = {
  entries: HistoryEntry[];
  isLoading?: boolean;
  activeEntryId?: string | null;
  onRestore?: (entryId: string, mode: HistoryRestoreMode) => void;
  isRestoreDisabled?: boolean;
};

export function HistoryList({
  entries,
  isLoading = false,
  activeEntryId = null,
  onRestore,
  isRestoreDisabled = false,
}: HistoryListProps) {
  const punctuationModeLabels: Record<PunctuationMode, string> = {
    academic: "学術",
    japanese: "和文",
    western: "欧文",
  };

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
          まだ変換履歴がありません。AI変換を実行すると、ここに最新10件の結果が
          保存されます。
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
          const isActive = activeEntryId === entry.id;
          const cardClassName = [
            "rounded-md border p-3 transition-colors",
            isActive
              ? "border-brand-200 bg-brand-50/60"
              : "border-slate-200 bg-white",
          ].join(" ");

          return (
            <li
              key={entry.id}
              className={cardClassName}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(entry.createdAt).toLocaleString("ja-JP")}</span>
                <span>
                  {writingStyleLabel} / {punctuationModeLabels[entry.punctuationMode]}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-600">変換後</p>
                  <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-2 text-slate-600">
                    {entry.outputText || entry.inputText}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-600">変換前</p>
                  <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-white p-2 text-slate-500">
                    {entry.inputText}
                  </p>
                </div>
              </div>
              {onRestore && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onRestore(entry.id, "output")}
                    disabled={isRestoreDisabled}
                    className="rounded-md border border-brand-200 bg-brand-100 px-3 py-1 font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    変換結果を復元
                  </button>
                  <button
                    type="button"
                    onClick={() => onRestore(entry.id, "input")}
                    disabled={isRestoreDisabled}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    変換前に戻す
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
