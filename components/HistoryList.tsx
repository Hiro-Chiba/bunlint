import clsx from "clsx";

import { writingStylePresets, type WritingStyle } from "@/lib/gemini";
import { clampScore } from "@/lib/jst";
import type { PunctuationMode } from "@/lib/punctuation";

export type HistoryEntry = {
  id: string;
  inputText: string;
  outputText: string;
  writingStyle: WritingStyle;
  writingStyleLabel?: string;
  punctuationMode: PunctuationMode;
  createdAt: string;
  aiUsageRate: number | null;
};

const resolveAiUsageTone = (
  value: number | null,
): "low" | "medium" | "high" | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = clampScore(value);
  if (normalized >= 75) {
    return "high";
  }

  if (normalized >= 40) {
    return "medium";
  }

  return "low";
};

type HistoryListProps = {
  entries: HistoryEntry[];
  isLoading?: boolean;
};

export function HistoryList({ entries, isLoading = false }: HistoryListProps) {
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
          const aiUsageRate =
            typeof entry.aiUsageRate === "number"
              ? clampScore(entry.aiUsageRate)
              : null;
          const aiUsageTone = resolveAiUsageTone(aiUsageRate);
          const aiUsageLabel =
            aiUsageRate === null ? "未計測" : `${aiUsageRate}%`;
          const aiUsageBadgeClass = clsx(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold",
            aiUsageTone === "low" &&
              "border-emerald-200 bg-emerald-50 text-emerald-700",
            aiUsageTone === "medium" &&
              "border-amber-200 bg-amber-50 text-amber-700",
            aiUsageTone === "high" && "border-rose-200 bg-rose-50 text-rose-700",
            aiUsageTone === null &&
              "border-slate-200 bg-slate-100 text-slate-500",
          );

          return (
            <li
              key={entry.id}
              className="rounded-md border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{new Date(entry.createdAt).toLocaleString("ja-JP")}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {writingStyleLabel} / {punctuationModeLabels[entry.punctuationMode]}
                  </span>
                  <span className={aiUsageBadgeClass}>
                    AI利用率: {aiUsageLabel}
                  </span>
                </div>
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
