import { convertPunctuation, type PunctuationMode } from "./punctuation";
import { getHighAccuracyModelName } from "./high-accuracy";

export type WritingStyle =
  | "dearu"
  | "desumasu"
  | "humanize_dearu"
  | "humanize_desumasu";

export type StylePreset = {
  label: string;
  description: string;
  toneInstruction: string;
  strictToneInstruction?: string;
  additionalDirectives?: string[];
  sample?: {
    before: string;
    after: string;
    note?: string;
  };
};

type StrictEnforcementLevel = "standard" | "reinforced" | "maximum";

type AttemptConfig = {
  strictMode: boolean;
  temperature: number;
  enforcementLevel: StrictEnforcementLevel;
};

const MAX_DEARU_ATTEMPTS = 4;

export const writingStylePresets: Record<WritingStyle, StylePreset> = {
  dearu: {
    label: "だ・である調",
    description: "論文やレポートに適した、格調高い文体に整えます。",
    toneInstruction:
      "文体は常に『だ・である調』に統一し、丁寧語やですます調を使用しないでください。",
    strictToneInstruction:
      "丁寧語の語尾（です・ます・でした など）が一切残らないようにし、各文末を「だ」「である」「ではない」「であった」などの常体で統一してください。",
  },
  desumasu: {
    label: "です・ます調",
    description: "ビジネス文書や丁寧な説明文を想定した、読みやすい文体です。",
    toneInstruction:
      "文体は常に『です・ます調』に統一し、終止形は「です」「ます」で終わるようにしてください。",
    strictToneInstruction:
      "常体（だ・である 等）の語尾が残らないように確認し、すべての文末を「です」「ます」などの丁寧語で終わらせてください。",
  },
  humanize_desumasu: {
    label: "人間らしい変換（です・ます）",
    description:
      "段落構成や接続詞を整えつつ、丁寧で自然な語り口に整えるモードです。",
    toneInstruction:
      "文体は常に『です・ます調』に統一し、終止形は「です」「ます」で終わるようにしてください。",
    strictToneInstruction:
      "常体（だ・である 等）の語尾が残らないように確認し、すべての文末を「です」「ます」などの丁寧語で終わらせてください。",
    additionalDirectives: [
      "段落の切れ目や話題のまとまりを整理し、必要に応じて段落を分割または結合してください。",
      "要点が伝わりやすくなるよう、接続詞や指示語を補ったり語順を整えたりして文章の流れを滑らかにしてください。",
      "意味や事実関係を変えずに、語尾・助詞・表現のぎこちなさを自然な言い回しへ調整してください。",
    ],
    sample: {
      before:
        "昨日は雨で外に出るのをやめようと思った。友人との約束があったので行った。帰るころには疲れていて、そのまま寝た。",
      after:
        "昨日は雨だったので外出を迷いましたが、友人との約束があったため出かけました。用事を終えるころにはすっかり疲れており、帰宅後はすぐに休みました。",
      note: "段落や接続詞を整え、内容は変えずに読みやすさを高めた例です。",
    },
  },
  humanize_dearu: {
    label: "人間らしい変換（だ・である）",
    description:
      "論理的な構成と常体の語尾を両立させ、硬さを抑えた自然な文章に調整します。",
    toneInstruction:
      "文体は常に『だ・である調』に統一し、丁寧語やですます調を使用しないでください。",
    strictToneInstruction:
      "丁寧語の語尾（です・ます・でした など）が一切残らないようにし、各文末を「だ」「である」「ではない」「であった」などの常体で統一してください。",
    additionalDirectives: [
      "段落の切れ目や話題のまとまりを整理し、必要に応じて段落を分割または結合してください。",
      "要点が伝わりやすくなるよう、接続詞や指示語を補ったり語順を整えたりして文章の流れを滑らかにしてください。",
      "意味や事実関係を変えずに、語尾・助詞・表現のぎこちなさを自然な言い回しへ調整してください。",
    ],
    sample: {
      before:
        "昨日は雨で外に出るのをやめようと思った。友人との約束があったので行った。帰るころには疲れていて、そのまま寝た。",
      after:
        "昨日は雨だったため外出を迷ったが、友人との約束があったので出かけた。用事を終えるころにはすっかり疲れており、帰宅後はすぐに休んだ。",
      note: "常体を維持しながら段落構成と接続を滑らかに整えた例です。",
    },
  },
};

const WRITING_STYLE_VALUES = Object.keys(writingStylePresets) as WritingStyle[];

const LEGACY_WRITING_STYLE_ALIASES: Record<string, WritingStyle> = {
  humanize: "humanize_desumasu",
};

const LEGACY_WRITING_STYLE_LABELS: Record<string, WritingStyle> = {
  人間らしい構成: "humanize_desumasu",
};

const DEARU_STYLE_SET = new Set<WritingStyle>(["dearu", "humanize_dearu"]);

const isDearuStyle = (style: WritingStyle): boolean =>
  DEARU_STYLE_SET.has(style);

export const writingStyleSelectGroups: Array<{
  label: string;
  styles: WritingStyle[];
}> = [
  { label: "基本の語尾スタイル", styles: ["desumasu", "dearu"] },
  {
    label: "人間らしい文章構成",
    styles: ["humanize_desumasu", "humanize_dearu"],
  },
];

export function isWritingStyle(value: unknown): value is WritingStyle {
  return (
    typeof value === "string" &&
    WRITING_STYLE_VALUES.includes(value as WritingStyle)
  );
}

export function normalizeWritingStyle(value: unknown): WritingStyle | null {
  if (isWritingStyle(value)) {
    return value;
  }

  if (typeof value === "string" && value in LEGACY_WRITING_STYLE_ALIASES) {
    return LEGACY_WRITING_STYLE_ALIASES[value];
  }

  return null;
}

export function resolveWritingStyleFromLabel(
  label: unknown,
): WritingStyle | null {
  if (typeof label !== "string" || !label) {
    return null;
  }

  for (const [value, preset] of Object.entries(writingStylePresets) as Array<
    [WritingStyle, (typeof writingStylePresets)[WritingStyle]]
  >) {
    if (preset.label === label) {
      return value;
    }
  }

  if (label in LEGACY_WRITING_STYLE_LABELS) {
    return LEGACY_WRITING_STYLE_LABELS[label];
  }

  return null;
}

export type GeminiTransformRequest = {
  inputText: string;
  writingStyle: WritingStyle;
  punctuationMode: PunctuationMode;
  temperature?: number;
  useHighAccuracyModel?: boolean;
};

export type GeminiTransformResult = {
  outputText: string;
  rawResponse?: unknown;
};

export type AiConfidenceLevel = "low" | "medium" | "high";

export type AiCheckerResult = {
  score: number;
  confidence: AiConfidenceLevel;
  reasoning: string;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_FLASH_MODEL = "gemini-2.0-flash";
const DEFAULT_API_VERSIONS = ["v1beta", "v1"] as const;

export class GeminiError extends Error {
  status: number;

  constructor(
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "GeminiError";
    this.status = options.status ?? 500;
  }
}

export function toUserFacingGeminiErrorMessage(error: GeminiError): string {
  if (/GEMINI_API_KEY/.test(error.message)) {
    return "AI変換の設定が完了していません。管理者にお問い合わせください。";
  }

  if (/Gemini/i.test(error.message)) {
    return error.message
      .replace(/Gemini API\s*/gi, "AI変換")
      .replace(/Gemini/gi, "AI");
  }

  return error.message;
}

function normalizeModelName(model: string): string {
  return model
    .trim()
    .replace(/^models\//, "")
    .replace(/\s+/g, "-");
}

function resolveGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL;

  if (typeof envModel === "string" && envModel.trim().length > 0) {
    return normalizeModelName(envModel);
  }

  return DEFAULT_GEMINI_MODEL;
}

function buildModelAttemptOrder({
  baseModel,
  useHighAccuracyModel = false,
}: {
  baseModel: string;
  useHighAccuracyModel?: boolean;
}): string[] {
  const order: string[] = [];
  const normalizedBase = normalizeModelName(baseModel);

  if (useHighAccuracyModel) {
    order.push(getHighAccuracyModelName());
  }

  order.push(normalizedBase);

  if (normalizedBase === DEFAULT_GEMINI_MODEL) {
    order.push(GEMINI_FLASH_MODEL);
  } else if (normalizedBase === GEMINI_FLASH_MODEL) {
    order.push(DEFAULT_GEMINI_MODEL);
  }

  return Array.from(new Set(order.map(normalizeModelName)));
}

function resolveGeminiApiVersions(): string[] {
  const envVersions = process.env.GEMINI_API_VERSION;

  if (typeof envVersions === "string" && envVersions.trim().length > 0) {
    const versions = envVersions
      .split(",")
      .map((version) => version.trim())
      .filter((version) => version.length > 0);

    if (versions.length > 0) {
      return versions;
    }
  }

  return [...DEFAULT_API_VERSIONS];
}

function shouldRetryWithNextVersion(error: GeminiError): boolean {
  if (error.status === 404) {
    return true;
  }

  if (
    error.status === 400 &&
    /not found for api version/i.test(error.message)
  ) {
    return true;
  }

  return false;
}

async function requestGeminiApi({
  apiKey,
  model,
  version,
  payload,
  convertOutputMode,
}: {
  apiKey: string;
  model: string;
  version: string;
  payload: unknown;
  convertOutputMode?: PunctuationMode | null;
}): Promise<GeminiTransformResult> {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;

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
        // ignore JSON parse errors for the error body
      }
    }

    throw new GeminiError(
      `${errorMessage} (model: ${model}, version: ${version})`,
      {
        status: response.status,
        cause: parsedBody,
      },
    );
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
    throw new GeminiError("Gemini API から有効な文章を取得できませんでした。", {
      status: 502,
    });
  }

  return {
    outputText:
      convertOutputMode && typeof convertOutputMode === "string"
        ? convertPunctuation(outputText, convertOutputMode)
        : outputText,
    rawResponse: data,
  };
}

type BuildPromptOptions = GeminiTransformRequest & {
  strictMode?: boolean;
  validationDirective?: string | null;
  enforcementLevel?: StrictEnforcementLevel;
};

function buildPrompt({
  inputText,
  writingStyle,
  punctuationMode,
  strictMode = false,
  validationDirective,
  enforcementLevel = "standard",
}: BuildPromptOptions): string {
  const preset = writingStylePresets[writingStyle];
  let punctuationInstruction: string;

  switch (punctuationMode) {
    case "academic":
      punctuationInstruction = "句読点は必ず「，」「．」を使用してください。";
      break;
    case "western":
      punctuationInstruction =
        "句読点は必ず半角の「,」「.」を使用してください。";
      break;
    default:
      punctuationInstruction = "句読点は必ず「、」「。」を使用してください。";
      break;
  }

  const instructions: string[] = [
    "- 入力文を大幅に書き換えず、意味や事実関係を保ったまま語尾や表現を整えてください。",
  ];

  if (
    strictMode &&
    validationDirective &&
    validationDirective.trim().length > 0
  ) {
    instructions.push(`- ${validationDirective.trim()}`);
  }

  instructions.push(`- ${preset.toneInstruction}`);

  if (strictMode && preset.strictToneInstruction) {
    instructions.push(`- ${preset.strictToneInstruction}`);
  }

  if (Array.isArray(preset.additionalDirectives)) {
    for (const directive of preset.additionalDirectives) {
      if (typeof directive === "string" && directive.trim().length > 0) {
        instructions.push(`- ${directive.trim()}`);
      }
    }
  }

  instructions.push(`- ${punctuationInstruction}`);
  instructions.push(
    "- 変換後のテキストのみを出力し、説明文や補足は書かないでください。",
  );
  instructions.push(
    "- あいさつや了承の返答など、変換結果と無関係な文章を冒頭や末尾に付け加えないでください。",
  );
  instructions.push(
    "- ヘッダー、箇条書き、引用、コードブロックなどの装飾を使わず、本文のみをそのまま出力してください。",
  );

  if (strictMode) {
    instructions.push(
      "- 出力前に文体の揺れが残っていないか自己チェックし、丁寧語と常体が混在しないようにしてください。",
    );
    for (const reinforcementInstruction of getStrictReinforcementInstructions(
      writingStyle,
      enforcementLevel,
    )) {
      instructions.push(reinforcementInstruction);
    }
  }

  return `あなたは日本語文章の編集アシスタントです。以下の指示に従ってテキストを整形してください。

# 指示
${instructions.join("\n")}

# 入力文
${inputText.trim()}`;
}

function getStrictReinforcementInstructions(
  writingStyle: WritingStyle,
  enforcementLevel: StrictEnforcementLevel,
): string[] {
  if (!isDearuStyle(writingStyle)) {
    return [];
  }

  const instructions: string[] = [];

  if (enforcementLevel === "reinforced" || enforcementLevel === "maximum") {
    instructions.push(
      "- 例: 「この結果です。」→「この結果である。」、「確認します。」→「確認する。」のように丁寧語を常体に言い換えてください。",
    );
  }

  if (enforcementLevel === "maximum") {
    instructions.push(
      "- 各文を声に出すつもりで確認し、丁寧語（です・ます・でした など）が残っていれば必ず常体に修正してから出力してください。",
    );
    instructions.push(
      "- 最終出力の直前に丁寧語が1つでも残っていないか再点検し、問題があれば修正が完了するまで出力しないでください。",
    );
  }

  return instructions;
}

function extractTextFromResponse(data: any): string | null {
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

function shouldFallbackToAlternateModel(error: GeminiError): boolean {
  if (error.status === 429 || error.status === 503 || error.status === 507) {
    return true;
  }

  if (error.status === 500) {
    return true;
  }

  const message = error.message.toLowerCase();

  return /quota|exhausted|overloaded|try again later/.test(message);
}

async function executeGeminiRequest({
  apiKey,
  models,
  apiVersions,
  payload,
  convertOutputMode,
}: {
  apiKey: string;
  models: string[];
  apiVersions: string[];
  payload: unknown;
  convertOutputMode?: PunctuationMode | null;
}): Promise<GeminiTransformResult> {
  const errors: GeminiError[] = [];

  for (const model of models) {
    for (const version of apiVersions) {
      try {
        return await requestGeminiApi({
          apiKey,
          model,
          version,
          payload,
          convertOutputMode,
        });
      } catch (error) {
        if (error instanceof GeminiError) {
          errors.push(error);

          if (shouldRetryWithNextVersion(error)) {
            continue;
          }

          if (shouldFallbackToAlternateModel(error)) {
            continue;
          }
        }

        throw error;
      }
    }

  }

  if (errors.length > 0) {
    throw errors[errors.length - 1];
  }

  throw new GeminiError("Gemini API の呼び出しに失敗しました。", {
    status: 500,
  });
}

const AI_CHECKER_PROMPT = [
  "あなたは文章がAIによって生成された可能性を評価する監査員です。",
  "以下の日本語テキストを分析し、AI生成らしさを0〜100の整数で推定してください。",
  "0はほぼ人間による文章、100はほぼAIによる文章を意味します。",
  "結果は必ず次のJSON形式のみで返してください。余計な文章や説明は含めないでください。",
  '{"score": <0-100の整数>, "confidence": "<low|medium|high>", "reasoning": "<日本語での根拠>"}',
  "confidenceは推定したAIらしさのレベルを表します。low=AIらしさが低い、medium=判断が難しい、high=AIらしさが高いという意味で使用してください。",
].join("\n");

const DEFAULT_REASONING_BY_CONFIDENCE: Record<AiConfidenceLevel, string> = {
  low: "AI生成らしさは低いと判断されました。",
  medium: "AI生成らしさは中程度と判断されました。",
  high: "AI生成らしさが高いと判断されました。",
};

type CreateAiCheckerPayloadOptions = {
  text: string;
  temperature: number;
};

function createAiCheckerPayload({
  text,
  temperature,
}: CreateAiCheckerPayloadOptions) {
  const sanitized = text.replace(/\r/g, "").trim();
  const prompt = `${AI_CHECKER_PROMPT}\n\n--- テキストここから ---\n${sanitized}\n--- テキストここまで ---`;

  return {
    contents: [
      {
        role: "user" as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      topP: 0.8,
      topK: 32,
    },
  };
}

function extractJsonSnippet(text: string): string | null {
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

const POLITE_ENDINGS = [
  "です",
  "でした",
  "でしょう",
  "でしょうか",
  "ですよ",
  "ですね",
  "でしょ",
  "でして",
  "でございます",
  "でございました",
  "ます",
  "ました",
  "ません",
  "ませんでした",
  "ませんか",
  "ますか",
  "ましょう",
  "ましょうか",
  "ください",
  "下さい",
  "ございます",
  "ございますか",
];

const TRAILING_SYMBOLS_PATTERN =
  /[\s\u3000「」『』（）【】［］〈〉《》｛｝]+$/gu;
const SENTENCE_DELIMITER_PATTERN = /[^。．\.！？\?]+[。．\.！？\?]?/gu;
const MARKDOWN_CODE_FENCE_START = /^```[^\n]*\n/;
const MARKDOWN_CODE_FENCE_END = /\n```[ \t]*$/;
const ACKNOWLEDGEMENT_KEYWORDS = [
  "了解しました",
  "了承しました",
  "承知しました",
  "承知いたしました",
  "かしこまりました",
  "もちろんです",
  "了解です",
  "了解いたしました",
  "わかりました",
  "分かりました",
  "理解しました",
  "ご確認ください",
  "以下が整えた文章です",
  "以下が整えた文です",
  "以下が変換後の文章です",
  "以下が修正後の文章です",
  "以下に整形後の文章を示します",
  "変換後の文章です",
  "変換後のテキストです",
  "整えた文章です",
  "整形後の文章です",
  "編集結果です",
  "ご確認ください。",
];

function sanitizeSentenceEnding(sentence: string): string {
  return sentence.replace(TRAILING_SYMBOLS_PATTERN, "");
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\r/g, "");
  const sentences: string[] = [];

  for (const block of normalized.split(/\n+/)) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) {
      continue;
    }

    const matches = trimmedBlock.match(SENTENCE_DELIMITER_PATTERN);
    if (matches) {
      for (const match of matches) {
        const sentence = match.trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
      }
      continue;
    }

    sentences.push(trimmedBlock);
  }

  if (sentences.length === 0) {
    const fallback = normalized.trim();
    if (fallback.length > 0) {
      sentences.push(fallback);
    }
  }

  return sentences;
}

function hasPoliteEnding(sentence: string): boolean {
  const withoutEndingSymbols = sanitizeSentenceEnding(sentence);
  const normalized = withoutEndingSymbols
    .replace(/[。．\.！？\?…〜～・、，\s\u3000]+$/gu, "")
    .trim();

  if (!normalized) {
    return false;
  }

  return POLITE_ENDINGS.some((ending) => normalized.endsWith(ending));
}

function normalizeSentenceForDirective(sentence: string): string {
  return sanitizeSentenceEnding(sentence).trim();
}

function buildDearuValidationDirective(sentences: string[]): string {
  const normalizedSentences = sentences
    .map((sentence) => normalizeSentenceForDirective(sentence))
    .filter((sentence) => sentence.length > 0);

  if (normalizedSentences.length === 0) {
    return "丁寧語の語尾を常体に書き換え、最終的な出力では丁寧語を使用しないでください。";
  }

  const bulletList = normalizedSentences
    .map((sentence) => `  - ${sentence}`)
    .join("\n");

  return `以下の文で丁寧語の語尾が残っています。必ず常体に書き換えてください。\n${bulletList}\n  修正後は全文を読み返し、丁寧語が残っていないことを確認してから出力してください。`;
}

type StyleValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      directive: string;
      offendingSentences: string[];
    };

export function validateWritingStyleCompliance(
  text: string,
  writingStyle: WritingStyle,
): StyleValidationResult {
  if (!isDearuStyle(writingStyle)) {
    return { ok: true };
  }

  const sentences = splitIntoSentences(text);
  const violations = sentences.filter((sentence) => hasPoliteEnding(sentence));

  if (violations.length === 0) {
    return { ok: true };
  }

  const normalizedViolations = violations.map((sentence) =>
    normalizeSentenceForDirective(sentence),
  );

  const sampleSource = normalizedViolations[0] ?? violations[0];
  const sample =
    sampleSource.length > 30 ? `${sampleSource.slice(0, 30)}…` : sampleSource;

  return {
    ok: false,
    reason: `だ・である調に統一できませんでした。丁寧語の語尾（です・ます）が残っています（例: 「${sample}」）。`,
    directive: buildDearuValidationDirective(violations),
    offendingSentences: normalizedViolations,
  };
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdownCodeFences(text: string): string {
  if (!text.startsWith("```") || !MARKDOWN_CODE_FENCE_START.test(text)) {
    return text;
  }

  if (!MARKDOWN_CODE_FENCE_END.test(text.trimEnd())) {
    return text;
  }

  return text
    .replace(MARKDOWN_CODE_FENCE_START, "")
    .replace(MARKDOWN_CODE_FENCE_END, "")
    .trim();
}

function removeLeadingAcknowledgementSentences(
  text: string,
  writingStyle: WritingStyle,
): string {
  if (!isDearuStyle(writingStyle)) {
    return text.trim();
  }

  const sentences = splitIntoSentences(text);
  const removableSentences: string[] = [];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) {
      continue;
    }

    const hasKeyword = ACKNOWLEDGEMENT_KEYWORDS.some((keyword) =>
      trimmedSentence.includes(keyword),
    );

    if (!hasKeyword) {
      break;
    }

    if (!hasPoliteEnding(sentence)) {
      break;
    }

    removableSentences.push(trimmedSentence);
  }

  if (removableSentences.length === 0) {
    return text.trim();
  }

  let remainder = text.trimStart();

  for (const sentence of removableSentences) {
    remainder = remainder.trimStart();
    const pattern = new RegExp(
      `^${escapeForRegExp(sentence)}[\s\u3000「」『』（）()【】［］〈〉《》｛｝]*`,
      "u",
    );
    const match = remainder.match(pattern);
    if (!match) {
      break;
    }
    remainder = remainder.slice(match[0].length);
  }

  const trimmedRemainder = remainder.trimStart();
  return trimmedRemainder.length > 0 ? trimmedRemainder : text.trim();
}

export function normalizeGeminiOutput(
  text: string,
  writingStyle: WritingStyle,
): string {
  if (!text) {
    return "";
  }

  let normalized = text.replace(/\r/g, "").trim();

  if (!normalized) {
    return normalized;
  }

  normalized = stripMarkdownCodeFences(normalized);
  normalized = removeLeadingAcknowledgementSentences(normalized, writingStyle);

  return normalized.trim();
}
