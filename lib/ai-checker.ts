import { GeminiError, extractTextFromResponse, resolveGeminiApiVersions, resolveGeminiModel, shouldRetryWithNextVersion } from "./gemini";
import { clampScore } from "./jst";

const DEFAULT_TEMPERATURE = 0.2;
const PROMPT_TEMPLATE = `あなたは文章がAIによって生成された可能性を推定する専門家です。入力された日本語テキストを精査し、AI生成らしさを0から100までの整数値で評価してください。0に近いほど人間が書いた可能性が高く、100に近いほどAIが生成した可能性が高いとみなします。評価の根拠も短く述べてください。\n\n出力は必ず次のJSON形式で返してください。余計な文章や説明は書かないでください。\n{\n  "ai_likelihood_percent": <0-100の整数>,\n  "explanation": "評価の理由（日本語で120文字以内）"\n}\n\n入力文:\n"`;

function buildPrompt(inputText: string): string {
  return `${PROMPT_TEMPLATE}${inputText.trim()}"`;
}

type AiCheckerModelResult = {
  score: number;
  explanation: string;
};

function extractJson(text: string): string | null {
  const sanitized = text.trim();

  if (!sanitized) {
    return null;
  }

  const withoutFence = sanitized.startsWith("```")
    ? sanitized
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "")
        .trim()
    : sanitized;

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || start > end) {
    return null;
  }

  return withoutFence.slice(start, end + 1);
}

export function parseAiCheckerModelOutput(outputText: string): AiCheckerModelResult {
  if (!outputText || typeof outputText !== "string") {
    throw new GeminiError("AIチェッカーのレスポンスが空でした。", { status: 502 });
  }

  const jsonCandidate = extractJson(outputText);

  if (!jsonCandidate) {
    throw new GeminiError("AIチェッカーのレスポンスをJSONとして解析できませんでした。", {
      status: 502,
    });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch (error) {
    throw new GeminiError("AIチェッカーのレスポンス解析に失敗しました。", {
      status: 502,
      cause: error,
    });
  }

  const scoreKeys = [
    "ai_likelihood_percent",
    "aiLikelihoodPercent",
    "score",
    "likelihood",
    "aiScore",
  ];

  let rawScore: unknown = null;
  for (const key of scoreKeys) {
    if (rawScore == null && Object.prototype.hasOwnProperty.call(parsed, key)) {
      rawScore = parsed[key];
    }
  }

  const numericScore =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string" && rawScore.trim().length > 0
        ? Number(rawScore)
        : Number.NaN;

  if (!Number.isFinite(numericScore)) {
    throw new GeminiError("AIチェッカーの結果からスコアを取得できませんでした。", {
      status: 502,
    });
  }

  const explanationSource: unknown =
    typeof parsed.explanation === "string"
      ? parsed.explanation
      : typeof parsed.reason === "string"
        ? parsed.reason
        : typeof parsed.detail === "string"
          ? parsed.detail
          : null;

  const explanation =
    typeof explanationSource === "string" ? explanationSource.trim() : "";

  if (!explanation) {
    throw new GeminiError("AIチェッカーの説明文が空でした。", { status: 502 });
  }

  return {
    score: clampScore(numericScore),
    explanation,
  };
}

export function describeAiLikelihood(score: number): string {
  const normalized = clampScore(score);

  if (normalized >= 75) {
    return "AI生成の可能性が高い";
  }

  if (normalized >= 40) {
    return "AI生成の可能性は中程度";
  }

  return "人間が執筆した可能性が高い";
}

function createPayload(inputText: string) {
  const prompt = buildPrompt(inputText);

  return {
    contents: [
      {
        role: "user" as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: DEFAULT_TEMPERATURE,
    },
  };
}

export async function evaluateAiLikelihood(
  inputText: string,
): Promise<AiCheckerModelResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY が設定されていません。", { status: 500 });
  }

  const model = resolveGeminiModel();
  const apiVersions = resolveGeminiApiVersions();
  const payload = createPayload(inputText);

  const errors: GeminiError[] = [];

  for (const version of apiVersions) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;

    try {
      const response = await fetch(`${url}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();

      if (!response.ok) {
        let errorMessage = `Gemini API の呼び出しに失敗しました (status: ${response.status})`;
        let parsedBody: unknown = null;

        if (responseBody) {
          try {
            parsedBody = JSON.parse(responseBody);
            if (typeof (parsedBody as any)?.error?.message === "string") {
              errorMessage = (parsedBody as any).error.message;
            }
          } catch {
            // ignore JSON parse errors for error body
          }
        }

        throw new GeminiError(errorMessage, {
          status: response.status,
          cause: parsedBody,
        });
      }

      let data: any = null;
      if (responseBody) {
        try {
          data = JSON.parse(responseBody);
        } catch (error) {
          throw new GeminiError("Gemini API のレスポンス解析に失敗しました。", {
            status: 502,
            cause: error,
          });
        }
      }

      const outputText = extractTextFromResponse(data);

      if (!outputText) {
        throw new GeminiError("Gemini API からAIチェッカーの結果を取得できませんでした。", {
          status: 502,
        });
      }

      return parseAiCheckerModelOutput(outputText);
    } catch (error) {
      if (error instanceof GeminiError) {
        errors.push(error);
        if (shouldRetryWithNextVersion(error)) {
          continue;
        }
      }

      throw error;
    }
  }

  if (errors.length > 0) {
    throw errors[errors.length - 1];
  }

  throw new GeminiError("Gemini API の呼び出しに失敗しました。", { status: 500 });
}
