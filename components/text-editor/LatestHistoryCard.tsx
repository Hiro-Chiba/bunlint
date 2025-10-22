"use client";

import type { HistoryEntry } from "../HistoryList";

type LatestHistoryCardProps = {
  entry: HistoryEntry;
  writingStyleLabel: string;
  timestampLabel: string;
  punctuationModeLabel: string;
  onUndo: () => void;
  onReapply: () => void;
  isTransforming: boolean;
};

export function LatestHistoryCard({
  entry,
  writingStyleLabel,
  timestampLabel,
  punctuationModeLabel,
  onUndo,
  onReapply,
  isTransforming,
}: LatestHistoryCardProps) {
  return (
    <section className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/60 p-4 text-sm shadow-sm">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-brand-700">直近のAI変換</h3>
        <p className="text-xs text-brand-600">
          {timestampLabel}
          {writingStyleLabel ? ` / ${writingStyleLabel}` : ""}
          {` / ${punctuationModeLabel}`}
        </p>
      </header>
      <div className="grid gap-3 text-xs text-slate-700">
        <div>
          <p className="font-semibold text-slate-600">変換後</p>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-brand-100 bg-white p-2 text-slate-700">
            {entry.outputText || entry.inputText}
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-600">変換前</p>
          <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-brand-50 bg-brand-50/40 p-2 text-slate-600">
            {entry.inputText}
          </p>
        </div>
      </div>
      {typeof entry.aiScore === "number" && (
        <div className="rounded-md border border-emerald-200 bg-white/80 p-3 text-xs text-emerald-900">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="text-lg font-bold text-emerald-700">
              {Math.round(entry.aiScore)}%
            </span>
          </p>
          <p className="mt-1 text-[11px] text-emerald-800">
            判定日時:
            {new Date(entry.aiCheckedAt ?? entry.createdAt).toLocaleString(
              "ja-JP",
              { timeZone: "Asia/Tokyo" },
            )}
          </p>
          {entry.aiReasoning && (
            <p className="mt-1 whitespace-pre-wrap text-[11px] text-emerald-800">
              {entry.aiReasoning}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={onUndo}
          disabled={isTransforming}
          className="rounded-md border border-brand-300 bg-white px-3 py-1 font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          元のテキストに戻す
        </button>
        <button
          type="button"
          onClick={onReapply}
          disabled={isTransforming}
          className="rounded-md border border-brand-500 bg-brand-600 px-3 py-1 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          変換結果を再適用
        </button>
      </div>
      <p className="text-xs text-brand-700/80">
        巻き戻しはエディタの内容を即座に置き換えます。履歴から別の結果を選ぶことで、任意の変換を復元できます。
      </p>
    </section>
  );
}
