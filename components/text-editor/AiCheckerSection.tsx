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
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h2 className="text-sm font-semibold text-slate-700">AIチェッカー</h2>
        <p className="mt-1 text-xs text-slate-500">
          テキストのAI生成らしさを解析し、スコアとコメントを表示します。
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>
          本日の残り判定回数: <span className="font-semibold text-slate-800">{remainingAiChecks}</span>
          <span className="text-slate-400">/{dailyLimit}</span>
        </span>
        {nextAiCheckLabel ? (
          <span className="whitespace-nowrap text-[11px] text-slate-500">
            次回リセット: {nextAiCheckLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={clsx(
            "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2",
            isButtonDisabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-brand-500 bg-brand-500 text-white hover:border-brand-400 hover:bg-brand-400",
          )}
          onClick={onInvokeAiCheck}
          disabled={isButtonDisabled}
        >
          {isCheckingAi ? "判定中..." : "AIらしさを判定"}
        </button>
        {hasReachedDailyLimit ? (
          <span className="text-xs text-rose-500">
            本日の利用上限に達しました。リセット時間以降に再度お試しください。
          </span>
        ) : isInputEmpty ? (
          <span className="text-xs text-slate-500">
            判定したい文章を入力するとAIチェッカーを実行できます。
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            入力中のテキストでAI生成らしさをチェックします。
          </span>
        )}
      </div>

      {aiCheckMessage ? (
        <p className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700" aria-live="polite">
          {aiCheckMessage}
        </p>
      ) : null}

      {aiResult && confidencePresentation ? (
        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500">AIらしさスコア</p>
              <p
                className={clsx(
                  "text-3xl font-bold tracking-tight",
                  confidencePresentation.scoreClass,
                )}
              >
                {normalizedScore}
                <span className="ml-1 text-base text-slate-400">/100</span>
              </p>
            </div>
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                confidencePresentation.badgeClass,
              )}
            >
              {confidencePresentation.badgeLabel}
            </span>
          </div>
          {reasoningMessage ? (
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {reasoningMessage}
            </p>
          ) : null}
          {aiCheckedAtLabel ? (
            <p className="text-xs text-slate-500">判定日時: {aiCheckedAtLabel}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
