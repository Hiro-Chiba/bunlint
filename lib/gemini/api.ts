import {
  type GeminiTransformResult,
  type GeminiTransformRequest,
  type AiCheckerResult,
  type AiConfidenceLevel,
  type AttemptConfig,
  type WritingStyle,
} from "./types";
import { DEARU_STYLE_SET } from "./constants";
import { GeminiError } from "./errors";
import {
  buildPrompt,
  createAiCheckerPayload,
  type BuildPromptOptions,
} from "./prompts";
import { normalizeGeminiOutput, validateWritingStyleCompliance } from "./validation";
import { resolveGeminiModel, resolveGeminiApiVersions, buildModelAttemptOrder } from "./config";
import { executeGeminiRequest } from "./client";
import { extractJsonSnippet, parseAiCheckerResponse } from "./parser";
import { callOpenRouterChat } from "../openrouter/client";

const isDearuStyle = (style: WritingStyle): boolean =>
  DEARU_STYLE_SET.has(style);

const MAX_DEARU_ATTEMPTS = 4;

type AnalyzeAiLikelihoodParams = {
  text: string;
  temperature?: number;
};

type GeminiSuspiciousSegment = {
  segment_id: number;
  location: string;
  reason: string;
  score: number;
};

type GeminiMainCheck = {
  overall_score: number;
  overall_judgement: "low" | "medium" | "high";
  suspicious_segments: GeminiSuspiciousSegment[];
  notes?: string;
};

type NovaSecondaryReview = {
  segment_id: number;
  secondary_score: number;
  agreement: boolean;
  reason: string;
};

const MAIN_PROMPT_TEMPLATE = `あなたはAI生成文章検出の専門システムです。
以下の文章について、人間が書いた可能性とAIが書いた可能性を冷静に分析してください。

重要な制約：
・AI生成と断定してはいけません
・統計的・言語的特徴から「兆候」を評価してください
・主観的な印象論は禁止です
・説明は最小限、構造化されたJSONのみを出力してください

評価観点：
1. 文体の一貫性（過剰な均質性、揺らぎの欠如）
2. 語彙分布（不自然な高頻度語・教科書的表現）
3. 論理展開（不自然な過不足、過剰な整理）
4. 人間特有の痕跡（曖昧さ、脱線、局所的冗長）
5. AI特有の痕跡（安全的言い換え、過度な網羅性）

タスク：
・文章全体を評価
・AI生成の兆候が強い箇所のみを抽出
・各箇所にスコアを付与

出力形式（厳守）：
{
  "overall_score": number,
  "overall_judgement": string,
  "suspicious_segments": [
    {
      "segment_id": number,
      "location": string,
      "reason": string,
      "score": number
    }
  ],
  "notes": string
}

解析対象の文章：
<<<TEXT>>>`;

const NOVA_PROMPT_TEMPLATE = `あなたは文章検証のセカンドオピニオンとして振る舞ってください。

以下は「AI生成の可能性がある」と一次判定された文章の抜粋です。
あなたの役割は、過剰検出を防ぐための再検証です。

制約：
・AI生成と断定してはいけません
・一次判定に引きずられないでください
・文章単体の自然さのみを評価してください

評価観点：
・人間が偶然この文体になる可能性
・学術的・業務的文章として自然か
・テンプレート文に見えるか

出力形式（厳守）：
{
  "segment_id": number,
  "secondary_score": number,
  "agreement": boolean,
  "reason": string
}

検証対象の文章：
<<<SEGMENT_TEXT>>>`;

function clampToUnit(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function parseJsonResponse<T>(raw: string, label: string): T {
  const snippet = extractJsonSnippet(raw);
  if (!snippet) {
    throw new GeminiError(`${label} の解析結果を読み取れませんでした。`, {
      status: 502,
    });
  }

  try {
    return JSON.parse(snippet) as T;
  } catch (error) {
    throw new GeminiError(`${label} の解析結果がJSON形式ではありません。`, {
      status: 502,
      cause: error,
    });
  }
}

async function requestGeminiFullCheck({
  text,
  temperature,
}: AnalyzeAiLikelihoodParams): Promise<GeminiMainCheck> {
  const prompt = MAIN_PROMPT_TEMPLATE.replace("<<<TEXT>>>", text.trim());

  const raw = await callOpenRouterChat({
    model: "google/gemini-2.0-flash-exp:free",
    messages: [{ role: "user", content: prompt }],
    temperature,
  });

  const parsed = parseJsonResponse<GeminiMainCheck>(raw, "Geminiメイン判定");

  const normalizedSegments = Array.isArray(parsed.suspicious_segments)
    ? parsed.suspicious_segments
        .filter((segment) => typeof segment?.segment_id === "number")
        .map((segment) => ({
          ...segment,
          score: clampToUnit(Number(segment.score ?? 0)),
          location: String(segment.location ?? ""),
          reason: String(segment.reason ?? ""),
        }))
    : [];

  return {
    overall_score: clampToUnit(Number(parsed.overall_score ?? 0)),
    overall_judgement: parsed.overall_judgement ?? "medium",
    suspicious_segments: normalizedSegments,
    notes: parsed.notes ?? "",
  };
}

async function requestNovaSecondaryChecks(
  segments: GeminiSuspiciousSegment[],
): Promise<NovaSecondaryReview[]> {
  const reviews: NovaSecondaryReview[] = [];

  for (const segment of segments) {
    const prompt = NOVA_PROMPT_TEMPLATE.replace(
      "<<<SEGMENT_TEXT>>>",
      `${segment.location ? `${segment.location}: ` : ""}${segment.reason}`,
    );

    const raw = await callOpenRouterChat({
      model: "amazon/nova-2-lite-v1:free",
      messages: [{ role: "user", content: prompt }],
    });

    const parsed = parseJsonResponse<NovaSecondaryReview>(raw, "Nova再検証");

    reviews.push({
      segment_id: Number(parsed.segment_id ?? segment.segment_id),
      secondary_score: clampToUnit(Number(parsed.secondary_score ?? 0)),
      agreement: Boolean(parsed.agreement),
      reason: parsed.reason ?? "",
    });
  }

  return reviews;
}

async function analyzeWithOpenRouter({
  text,
  temperature,
}: AnalyzeAiLikelihoodParams): Promise<AiCheckerResult> {
  const geminiMain = await requestGeminiFullCheck({ text, temperature });
  const novaReviews = await requestNovaSecondaryChecks(geminiMain.suspicious_segments);

  const finalScore = calculateFinalScore(geminiMain.overall_score, novaReviews);
  const confidence = determineConfidence(finalScore, geminiMain.overall_judgement);
  const reasoning = buildReasoning({ geminiMain, novaReviews, finalScore });

  return {
    score: Math.round(finalScore * 100),
    confidence,
    reasoning,
  };
}

function calculateFinalScore(
  geminiScore: number,
  novaReviews: NovaSecondaryReview[],
): number {
  const adjustedNovaScores = novaReviews.map((review) =>
    review.agreement ? review.secondary_score : review.secondary_score * 0.5,
  );

  const novaAverage =
    adjustedNovaScores.length === 0
      ? geminiScore
      : adjustedNovaScores.reduce((sum, value) => sum + value, 0) /
        adjustedNovaScores.length;

  return clampToUnit(0.7 * geminiScore + 0.3 * novaAverage);
}

function determineConfidence(
  normalizedScore: number,
  judgement: GeminiMainCheck["overall_judgement"],
): AiConfidenceLevel {
  if (normalizedScore >= 0.75 || judgement === "high") {
    return "high";
  }

  if (normalizedScore >= 0.45 || judgement === "medium") {
    return "medium";
  }

  return "low";
}

function buildReasoning({
  geminiMain,
  novaReviews,
  finalScore,
}: {
  geminiMain: GeminiMainCheck;
  novaReviews: NovaSecondaryReview[];
  finalScore: number;
}): string {
  const hints = [] as string[];

  hints.push(
    `Gemini統合スコアは${Math.round(geminiMain.overall_score * 100)}点（${geminiMain.overall_judgement}）でした。`,
  );

  if (geminiMain.notes) {
    hints.push(geminiMain.notes);
  }

  if (novaReviews.length > 0) {
    const avg =
      novaReviews.reduce((sum, review) => sum + review.secondary_score, 0) /
      novaReviews.length;
    const disagreements = novaReviews.filter((review) => !review.agreement)
      .length;
    hints.push(
      `Nova再検証の平均は${Math.round(avg * 100)}点で、不同意は${disagreements}件でした。`,
    );
  }

  hints.push(`最終スコアは${Math.round(finalScore * 100)}点です。`);

  return hints.join(" ");
}

type CreatePayloadOptions = BuildPromptOptions & {
  temperature: number;
};

function createGeminiPayload({
  temperature,
  ...promptOptions
}: CreatePayloadOptions) {
  const prompt = buildPrompt(promptOptions);

  return {
    contents: [
      {
        role: "user" as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
    },
  };
}

async function analyzeWithGeminiApi({
  text,
  temperature = 0.2,
}: AnalyzeAiLikelihoodParams): Promise<AiCheckerResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY が設定されていません。", {
      status: 500,
    });
  }

  const model = resolveGeminiModel();
  const apiVersions = resolveGeminiApiVersions();
  const payload = createAiCheckerPayload({ text, temperature });

  const result = await executeGeminiRequest({
    apiKey,
    models: buildModelAttemptOrder({ baseModel: model }),
    apiVersions,
    payload,
    convertOutputMode: null,
  });

  return parseAiCheckerResponse(result.outputText);
}

export async function analyzeAiLikelihoodWithGemini({
  text,
  temperature = 0.2,
}: AnalyzeAiLikelihoodParams): Promise<AiCheckerResult> {
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  if (hasOpenRouterKey) {
    try {
      return await analyzeWithOpenRouter({ text, temperature });
    } catch (error) {
      if (!hasGeminiKey) {
        throw error;
      }
    }
  }

  if (!hasGeminiKey) {
    throw new GeminiError(
      "AIチェッカーに必要な API キーが設定されていません (OPENROUTER_API_KEY または GEMINI_API_KEY)。",
      {
        status: 500,
      },
    );
  }

  return analyzeWithGeminiApi({ text, temperature });
}

export async function transformTextWithGemini({
  inputText,
  writingStyle,
  punctuationMode,
  temperature = 0.4,
  useHighAccuracyModel = false,
}: GeminiTransformRequest): Promise<GeminiTransformResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY が設定されていません。", {
      status: 500,
    });
  }

  const model = resolveGeminiModel();
  const apiVersions = resolveGeminiApiVersions();
  const models = buildModelAttemptOrder({
    baseModel: model,
    useHighAccuracyModel,
  });

  const baseTemperature = temperature;
  const attemptConfigs: AttemptConfig[] = isDearuStyle(writingStyle)
    ? [
        {
          strictMode: false,
          temperature: baseTemperature,
          enforcementLevel: "standard",
        },
        {
          strictMode: true,
          temperature: Math.min(baseTemperature, 0.25),
          enforcementLevel: "standard",
        },
      ]
    : [
        {
          strictMode: false,
          temperature: baseTemperature,
          enforcementLevel: "standard",
        },
      ];

  let validationDirective: string | null = null;
  let validationReason: string | null = null;
  let lastOffendingSentences: string[] = [];

  for (
    let attemptIndex = 0;
    attemptIndex < attemptConfigs.length;
    attemptIndex += 1
  ) {
    const attempt = attemptConfigs[attemptIndex];

    const payload = createGeminiPayload({
      inputText,
      writingStyle,
      punctuationMode,
      temperature: attempt.temperature,
      strictMode: attempt.strictMode,
      enforcementLevel: attempt.enforcementLevel,
      validationDirective,
    });

    const result = await executeGeminiRequest({
      apiKey,
      models,
      apiVersions,
      payload,
      convertOutputMode: punctuationMode,
    });

    const normalizedResult: GeminiTransformResult = {
      ...result,
      outputText: normalizeGeminiOutput(result.outputText, writingStyle),
    };

    const validation = validateWritingStyleCompliance(
      normalizedResult.outputText,
      writingStyle,
    );

    if (validation.ok) {
      return normalizedResult;
    }

    validationDirective = validation.directive;
    validationReason = validation.reason;
    lastOffendingSentences = validation.offendingSentences;

    if (
      isDearuStyle(writingStyle) &&
      attemptIndex === attemptConfigs.length - 1 &&
      attemptConfigs.length < MAX_DEARU_ATTEMPTS
    ) {
      const nextAttemptIndex = attemptConfigs.length;
      const nextConfig: AttemptConfig =
        nextAttemptIndex === 2
          ? {
              strictMode: true,
              temperature: Math.min(baseTemperature, 0.15),
              enforcementLevel: "reinforced",
            }
          : {
              strictMode: true,
              temperature: 0,
              enforcementLevel: "maximum",
            };

      attemptConfigs.push(nextConfig);
    }
  }

  if (validationReason) {
    const errorOptions: {
      status: number;
      cause?: { offendingSentences: string[] };
    } = {
      status: 502,
    };

    if (lastOffendingSentences.length > 0) {
      errorOptions.cause = { offendingSentences: lastOffendingSentences };
    }

    throw new GeminiError(validationReason, errorOptions);
  }

  throw new GeminiError("Gemini API の出力が文体の条件を満たしませんでした。", {
    status: 502,
  });
}
