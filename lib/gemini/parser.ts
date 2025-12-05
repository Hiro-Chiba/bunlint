import { GeminiError } from "./errors";
import { type AiCheckerResult, type AiConfidenceLevel } from "./types";
import { DEFAULT_REASONING_BY_CONFIDENCE } from "./constants";

export function extractTextFromResponse(data: any): string | null {
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    return null;
  }

  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return text.length > 0 ? text : null;
}

export function extractJsonSnippet(text: string): string | null {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return withoutFence.slice(start, end + 1);
}

function normalizeConfidenceLevel(
  value: unknown,
  score: number,
): AiConfidenceLevel {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      if (/(^|\b)(low|minor|small|weak|低|弱|小)(\b|$)/.test(normalized)) {
        return "low";
      }

      if (
        /(^|\b)(medium|moderate|mid|middle|normal|平均|中|ふつう|普通)(\b|$)/.test(
          normalized,
        )
      ) {
        return "medium";
      }

      if (/(^|\b)(high|strong|major|大|高|強)(\b|$)/.test(normalized)) {
        return "high";
      }
    }
  }

  if (score >= 66) {
    return "high";
  }

  if (score >= 34) {
    return "medium";
  }

  return "low";
}

function sanitizeScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(/[^0-9.+-]/g, ""));
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  throw new GeminiError("AIチェッカーのスコアを取得できませんでした。", {
    status: 502,
  });
}

export function parseAiCheckerResponse(raw: string): AiCheckerResult {
  const snippet = extractJsonSnippet(raw);

  if (!snippet) {
    throw new GeminiError("AIチェッカーの解析結果を読み取れませんでした。", {
      status: 502,
    });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(snippet);
  } catch (error) {
    throw new GeminiError(
      "AIチェッカーの解析結果がJSON形式ではありませんでした。",
      {
        status: 502,
        cause: error,
      },
    );
  }

  const scoreCandidate =
    parsed?.score ??
    parsed?.aiScore ??
    parsed?.likelihood ??
    parsed?.probability;
  const sanitizedScore = sanitizeScore(scoreCandidate);
  const clampedScore = Math.round(Math.max(0, Math.min(100, sanitizedScore)));

  const confidence = normalizeConfidenceLevel(
    parsed?.confidence ?? parsed?.level ?? parsed?.rating ?? parsed?.verdict,
    clampedScore,
  );

  const rawReasoning =
    typeof parsed?.reasoning === "string"
      ? parsed.reasoning
      : typeof parsed?.analysis === "string"
        ? parsed.analysis
        : typeof parsed?.summary === "string"
          ? parsed.summary
          : "";

  const reasoning =
    rawReasoning.trim() || DEFAULT_REASONING_BY_CONFIDENCE[confidence];

  return {
    score: clampedScore,
    confidence,
    reasoning,
  };
}
