"use client";

import clsx from "clsx";

import { AI_CONFIDENCE_PRESENTATION } from "./constants";
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
  hasCheckedOnSameDay,
  hasReachedDailyLimit,
  remainingAiChecks,
  nextAiCheckLabel,
  aiCheckMessage,
  aiResult,
  onInvokeAiCheck,
  dailyLimit,
}: AiCheckerSectionProps) {
  const trimmed = text.trim();
  const isButtonDisabled =
    isCheckingAi || hasReachedDailyLimit || trimmed.length === 0;

  const aiResultPresentation = aiResult
    ? AI_CONFIDENCE_PRESENTATION[aiResult.confidence] ??
      AI_CONFIDENCE_PRESENTATION.low
    : null;

  return (
    <section className="space-y-3 rounded-md border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-900">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-emerald-800">AIチェッカー</h3>
        <p className="text-xs text-emerald-700">
          AI生成らしさを0〜100%で判定します。日本時間で1日に
          {dailyLimit}回まで実行できます。
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={onInvokeAiCheck}
          disabled={isButtonDisabled}
          className="rounded-md border border-emerald-400 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-emerald-200 disabled:bg-emerald-200"
        >
          {isCheckingAi ? "判定中..." : "AI生成らしさを判定"}
        </button>
        {hasCheckedOnSameDay && !hasReachedDailyLimit &&
          remainingAiChecks < dailyLimit && (
            <span className="text-xs text-emerald-800">
              本日残り{remainingAiChecks}回判定できます。
            </span>
          )}
        {hasReachedDailyLimit && nextAiCheckLabel && (
          <span className="text-xs text-emerald-800">
            次回判定可能: {nextAiCheckLabel}
          </span>
        )}
      </div>
      {aiCheckMessage && (
        <p className="text-xs text-emerald-800">{aiCheckMessage}</p>
      )}
      {aiResult && aiResultPresentation && (
        <div className="space-y-2 rounded-md border border-emerald-200 bg-white p-3 text-xs text-emerald-900">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span
              className={clsx("text-lg font-bold", aiResultPresentation.scoreClass)}
            >
              {aiResult.score}%
            </span>
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold",
                aiResultPresentation.badgeClass,
              )}
            >
              {aiResultPresentation.badgeLabel}
            </span>
          </p>
          <p className="text-[11px] text-emerald-800">
            判定日時:
            {" "}
            {new Date(aiResult.checkedAt).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}
          </p>
          {aiResult.reasoning && (
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-emerald-800">
              {aiResult.reasoning}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
