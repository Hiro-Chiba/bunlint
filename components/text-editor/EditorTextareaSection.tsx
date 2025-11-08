"use client";

import clsx from "clsx";

import type { DiffSegment } from "@/lib/diff";

type EditorTextareaSectionProps = {
  text: string;
  onTextChange: (value: string) => void;
  statusMessage: string | null;
  statusMessageId: string;
  editorTitleId: string;
  editorDescriptionId: string;
  diffSegments: DiffSegment[] | null;
  diffTitleId: string;
  diffDescriptionId: string;
};

export function EditorTextareaSection({
  text,
  onTextChange,
  statusMessage,
  statusMessageId,
  editorTitleId,
  editorDescriptionId,
  diffSegments,
  diffTitleId,
  diffDescriptionId,
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
          テキストを入力して、句読点変換やAIチェックなどの機能をお試しください。
        </p>
      </header>
      <div className="relative">
        <textarea
          className="min-h-[16rem] w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="ここに文章を入力してください"
          aria-labelledby={editorTitleId}
          aria-describedby={textareaDescribedBy}
        />
      </div>
      {statusMessage && (
        <div
          role="status"
          id={statusMessageId}
          className="rounded-md border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700"
        >
          {statusMessage}
        </div>
      )}
      {diffSegments && (
        <section
          className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
          aria-labelledby={diffTitleId}
          aria-describedby={diffDescriptionId}
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <h3 id={diffTitleId} className="font-semibold text-slate-700">
              AI差分プレビュー
            </h3>
            <span>追加: 緑 / 削除: 赤</span>
          </div>
          <p id={diffDescriptionId} className="text-xs text-slate-500">
            AI変換による変更箇所を背景色でハイライト表示しています。
          </p>
          <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
            {diffSegments.map((segment, index) => {
              const isWhitespaceOnly = segment.value.trim().length === 0;
              return (
                <span
                  key={`diff-${index}`}
                  className={clsx(
                    segment.type === "added" && !isWhitespaceOnly
                      ? "rounded-sm bg-emerald-100 px-1 text-emerald-900"
                      : undefined,
                    segment.type === "removed" && !isWhitespaceOnly
                      ? "rounded-sm bg-rose-100 px-1 text-rose-900 line-through"
                      : segment.type === "removed"
                        ? "line-through text-rose-600"
                        : undefined,
                  )}
                >
                  {segment.value}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
