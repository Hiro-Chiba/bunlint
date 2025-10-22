import type { AiConfidenceLevel } from "@/lib/gemini";

export type AiCheckResultState = {
  score: number;
  confidence: AiConfidenceLevel;
  reasoning: string;
  checkedAt: string;
  textSnapshot: string;
};
