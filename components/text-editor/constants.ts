import type { AiConfidenceLevel } from "@/lib/gemini";

export const DEFAULT_AI_REASONING: Record<AiConfidenceLevel, string> = {
  low: "AI生成らしさは低いと判断されました。",
  medium: "AI生成らしさは中程度と判断されました。",
  high: "AI生成らしさが高いと判断されました。",
};

export const AI_CONFIDENCE_PRESENTATION: Record<
  AiConfidenceLevel,
  {
    scoreClass: string;
    badgeLabel: string;
    badgeClass: string;
  }
> = {
  low: {
    scoreClass: "text-emerald-700",
    badgeLabel: "AIらしさ低め",
    badgeClass:
      "border border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  medium: {
    scoreClass: "text-amber-600",
    badgeLabel: "AIらしさ中程度",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800",
  },
  high: {
    scoreClass: "text-rose-600",
    badgeLabel: "AIらしさ高め",
    badgeClass: "border border-rose-200 bg-rose-100 text-rose-800",
  },
};
