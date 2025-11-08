"use client";

import type { TextStats } from "@/lib/text";

import { StatsPanel } from "../StatsPanel";

type EditorTextareaSectionProps = {
  text: string;
  onTextChange: (value: string) => void;
  statusMessage: string | null;
  statusMessageId: string;
  editorTitleId: string;
  editorDescriptionId: string;
  stats: TextStats;
};

export function EditorTextareaSection({
  text,
  onTextChange,
  statusMessage,
  statusMessageId,
  editorTitleId,
  editorDescriptionId,
  stats,
}: EditorTextareaSectionProps) {
  const textareaDescribedBy = statusMessage
    ? `${editorDescriptionId} ${statusMessageId}`
    : editorDescriptionId;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="space-y-1">
        <h2 id={editorTitleId} className="text-lg font-semibold text-slate-800">
          テキストエディタ
        </h2>
        <p id={editorDescriptionId} className="text-sm text-slate-500">
          テキストを入力すると、文字数や文数がリアルタイムに更新されます。
        </p>
      </header>
      <textarea
        className="min-h-[16rem] w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="ここに文章を入力してください"
        aria-labelledby={editorTitleId}
        aria-describedby={textareaDescribedBy}
      />
      {statusMessage && (
        <div
          role="status"
          id={statusMessageId}
          className="rounded-md border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700"
        >
          {statusMessage}
        </div>
      )}
      <StatsPanel stats={stats} />
    </section>
  );
}
