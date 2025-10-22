import type React from "react";

import {
  writingStylePresets,
  type AiConfidenceLevel,
  type WritingStyle,
} from "@/lib/gemini";
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
  aiScore?: number;
  aiConfidence?: AiConfidenceLevel;
  aiReasoning?: string;
  aiCheckedAt?: string;
};

export type HistoryRestoreMode = "output" | "input";

type HistoryListProps = {
  entries: HistoryEntry[];
  isLoading?: boolean;
  activeEntryId?: string | null;
  onRestore?: (entryId: string, mode: HistoryRestoreMode) => void;
  isRestoreDisabled?: boolean;
  onDeleteEntry?: (entryId: string) => void;
};

const retentionLabel =
  HISTORY_RETENTION_MINUTES % 60 === 0
    ? `${HISTORY_RETENTION_MINUTES / 60}時間`
    : `${HISTORY_RETENTION_MINUTES}分`;

const retentionMessage = `保存から${retentionLabel}で自動削除されます。`;

const confidenceLabels: Record<AiConfidenceLevel, string> = {
  low: "AIらしさは低め",
  medium: "どちらとも言えない",
  high: "AIらしさが高い",
};

const confidenceBadgeClasses: Record<AiConfidenceLevel, string> = {
  low: "border-emerald-200 bg-emerald-100 text-emerald-700",
  medium: "border-amber-200 bg-amber-100 text-amber-700",
  high: "border-rose-200 bg-rose-100 text-rose-700",
};

function TrashIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 5.25h16.5M9.75 5.25l.75-1.5h3l.75 1.5M18 5.25v13.5a1.5 1.5 0 0 1-1.5 1.5H7.5a1.5 1.5 0 0 1-1.5-1.5V5.25m3 4.5v6m4.5-6v6"
      />
    </svg>
  );
}

function HistorySectionHeader() {
  return (
    <header>
      <h3 className="text-sm font-semibold text-slate-700">変換履歴</h3>
      <p className="mt-1 text-xs text-slate-400">{retentionMessage}</p>
    </header>
  );
}

export function HistoryList({
  entries,
  isLoading = false,
  activeEntryId = null,
  onRestore,
  isRestoreDisabled = false,
  onDeleteEntry,
}: HistoryListProps) {
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
              <div className="flex items-start justify-between gap-2 text-xs text-slate-500">
                <span className="leading-relaxed">
                  {new Date(entry.createdAt).toLocaleString("ja-JP")}
                </span>
                <div className="flex items-center gap-2 text-slate-500">
                  <span>
                    {writingStyleLabel} / {punctuationModeLabels[entry.punctuationMode]}
                  </span>
                  {onDeleteEntry && (
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label="この履歴を削除"
                      className="rounded-md border border-transparent p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:ring-offset-1"
                    >
                      <TrashIcon className="h-4 w-4" />
                      <span className="sr-only">この履歴を削除</span>
                    </button>
                  )}
                </div>
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
              {typeof entry.aiScore === "number" && (
                <div className="mt-3 space-y-1 rounded-md border border-emerald-100 bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-emerald-900">
                  <p className="text-xs font-semibold">AIチェッカー</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-lg font-bold text-emerald-700">
                      {Math.round(entry.aiScore)}%
                    </span>
                    {entry.aiConfidence && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceBadgeClasses[entry.aiConfidence]}`}
                      >
                        {confidenceLabels[entry.aiConfidence]}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    チェック日時:{" "}
                    {new Date(
                      entry.aiCheckedAt ?? entry.createdAt,
                    ).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </p>
                  {entry.aiReasoning && (
                    <p className="whitespace-pre-wrap text-[11px] text-emerald-800">
                      {entry.aiReasoning}
                    </p>
                  )}
                </div>
              )}
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
