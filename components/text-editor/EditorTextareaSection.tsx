"use client";

import clsx from "clsx";

import type { DiffSegment } from "@/lib/diff";
import { countCharacters } from "@/lib/text";

type EditorTextareaSectionProps = {
  text: string;
  onTextChange: (value: string) => void;
  onClear: () => void;
  onUndoLastTransform: () => void;
  canUndoLastTransform: boolean;
  isTransforming: boolean;
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
  onClear,
  onUndoLastTransform,
  canUndoLastTransform,
  isTransforming,
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

  const totalCharacters = countCharacters(text);
  const nonWhitespaceCharacters = countCharacters(text, {
    excludeWhitespace: true,
  });

  const counters = [
    { label: "総文字数", value: totalCharacters },
    { label: "空白除く", value: nonWhitespaceCharacters },
  ];

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id={editorTitleId} className="text-lg font-semibold text-slate-800">
            テキストエディタ
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUndoLastTransform}
              disabled={!canUndoLastTransform || isTransforming}
              className="inline-flex items-center justify-center rounded-md border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 shadow-sm transition-colors hover:border-brand-400 hover:text-brand-800 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
            >
              直近の変換を戻す
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={text.length === 0}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
            >
              クリア
            </button>
          </div>
        </div>
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
      <div className="flex items-center justify-end gap-6 border-t border-slate-100 bg-slate-50 px-4 py-3">
        {counters.map((counter, index) => (
          <div key={counter.label} className="flex items-center gap-3">
            {index > 0 && <div className="h-3 w-px bg-slate-200"></div>}
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-400">
                {counter.label}
              </span>
              <span className="text-sm font-bold text-slate-700">{counter.value}</span>
            </div>
          </div>
        ))}
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
