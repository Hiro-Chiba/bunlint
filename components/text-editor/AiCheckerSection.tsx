"use client";

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

export function AiCheckerSection(_: AiCheckerSectionProps) {
  return null;
}
