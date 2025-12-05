import type { AiConfidenceLevel } from "@/lib/gemini/index";

export type AiCheckResultState = {
  score: number;
  confidence: AiConfidenceLevel;
  reasoning: string;
  checkedAt: string;
  textSnapshot: string;
};

export type StatsHighlightMode = "none" | "words";
