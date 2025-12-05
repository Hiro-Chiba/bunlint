"use client";

import clsx from "clsx";
import { useMemo } from "react";

import { AI_CONFIDENCE_PRESENTATION, DEFAULT_AI_REASONING } from "./constants";
import type { AiCheckResultState } from "./types";

type AiCheckerSectionProps = {
  text: string;
  isCheckingAi: boolean;
  hasCheckedOnSameDay: boolean;
  hasReachedDailyLimit: boolean;
  remainingAiChecks: number;
  nextAiCheckLabel: string | null;
  aiCheckMessage: string | null;
  aiResult: AiCheckResultState | null;
  onInvokeAiCheck: () => void;
  dailyLimit: number;
};

export function AiCheckerSection({
  text,
  isCheckingAi,
  hasReachedDailyLimit,
  remainingAiChecks,
  nextAiCheckLabel,
  aiCheckMessage,
  aiResult,
  onInvokeAiCheck,
  dailyLimit,
}: AiCheckerSectionProps) {
  const trimmedText = text.trim();
  const isInputEmpty = trimmedText.length === 0;
  const isButtonDisabled = isCheckingAi || hasReachedDailyLimit || isInputEmpty;

  const aiCheckedAtLabel = useMemo(() => {
    if (!aiResult?.checkedAt) {
      return null;
    }

    const checkedAt = new Date(aiResult.checkedAt);
    if (!Number.isFinite(checkedAt.getTime())) {
      return null;
    }

    return checkedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  }, [aiResult]);

  const normalizedScore = aiResult ? Math.round(aiResult.score) : null;

  const confidencePresentation = aiResult
    ? AI_CONFIDENCE_PRESENTATION[aiResult.confidence]
    : null;

  const reasoningMessage = aiResult
    ? aiResult.reasoning?.trim() || DEFAULT_AI_REASONING[aiResult.confidence]
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              AI一貫性チェック
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              文脈、トーン、一貫性をAIが多角的に分析します。
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="text-xs font-medium text-slate-500">
            本日残り: <span className="font-bold text-slate-700">{remainingAiChecks}</span>
            <span className="text-slate-400">/{dailyLimit}回</span>
          </div>
          <button
            type="button"
            className={clsx(
              "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white transition-colors",
              isButtonDisabled
                ? "cursor-not-allowed bg-slate-300"
                : "bg-slate-900 hover:bg-slate-800 shadow-sm",
            )}
            onClick={onInvokeAiCheck}
            disabled={isButtonDisabled}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {isCheckingAi ? "解析中..." : "解析を実行"}
          </button>
        </div>
      </div>

      {aiCheckMessage ? (
        <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {aiCheckMessage}
        </div>
      ) : null}

      {aiResult && confidencePresentation ? (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                AIスコア
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-900">
                  {normalizedScore}
                </span>
                <span className="text-sm font-medium text-slate-500">/100</span>
              </div>
            </div>
            <span
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-bold",
                confidencePresentation.badgeClass,
              )}
            >
              {confidencePresentation.badgeLabel}
            </span>
          </div>
          {reasoningMessage ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {reasoningMessage}
            </div>
          ) : null}
          {aiCheckedAtLabel ? (
            <p className="mt-2 text-right text-xs text-slate-400">
              {aiCheckedAtLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
