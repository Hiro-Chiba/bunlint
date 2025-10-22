import { writingStylePresets, type WritingStyle } from "@/lib/gemini";
import { HISTORY_RETENTION_MINUTES } from "@/lib/history/constants";
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

const retentionLabel =
  HISTORY_RETENTION_MINUTES % 60 === 0
    ? `${HISTORY_RETENTION_MINUTES / 60}時間`
    : `${HISTORY_RETENTION_MINUTES}分`;

const retentionMessage = `保存から${retentionLabel}で自動削除されます。`;

function HistorySectionHeader() {
  return (
    <header>
      <h3 className="text-sm font-semibold text-slate-700">変換履歴</h3>
      <p className="mt-1 text-xs text-slate-400">{retentionMessage}</p>
    </header>
  );
}

export function HistoryList({ entries, isLoading = false }: HistoryListProps) {
  const punctuationModeLabels: Record<PunctuationMode, string> = {
    academic: "学術",
    japanese: "和文",
    western: "欧文",
  };

  if (isLoading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <HistorySectionHeader />
        <p className="mt-2 text-sm text-slate-500">読み込み中です...</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-200 bg-slate-100/60 p-4 text-sm text-slate-500">
        <HistorySectionHeader />
        <p className="mt-2">
          まだ変換履歴がありません。AI変換を実行すると、ここに最新10件の結果が
          保存されます。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <HistorySectionHeader />
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
                  {writingStyleLabel} / {punctuationModeLabels[entry.punctuationMode]}
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
