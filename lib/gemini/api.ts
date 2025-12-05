import {
  type GeminiTransformResult,
  type GeminiTransformRequest,
  type AiCheckerResult,
  type AttemptConfig,
  type WritingStyle,
} from "./types";
import { DEARU_STYLE_SET } from "./constants";
import { GeminiError } from "./errors";
import { parseAiCheckerResponse } from "./parser";
import { buildPrompt, createAiCheckerPayload, type BuildPromptOptions } from "./prompts";
import { normalizeGeminiOutput, validateWritingStyleCompliance } from "./validation";
import { resolveGeminiModel, resolveGeminiApiVersions, buildModelAttemptOrder } from "./config";
import { executeGeminiRequest } from "./client";

const isDearuStyle = (style: WritingStyle): boolean =>
  DEARU_STYLE_SET.has(style);

const MAX_DEARU_ATTEMPTS = 4;

type AnalyzeAiLikelihoodParams = {
  text: string;
  temperature?: number;
};

export async function analyzeAiLikelihoodWithGemini({
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
