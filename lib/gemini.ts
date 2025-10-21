import { convertPunctuation, type PunctuationMode } from "./punctuation";

export type WritingStyle = "dearu" | "desumasu" | "casual";

export type StylePreset = {
  label: string;
  description: string;
  toneInstruction: string;
  strictToneInstruction?: string;
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
    description: "論文やレポート向けの硬い文体に整えます。",
    toneInstruction:
      "文体は常に『だ・である調』に統一し、丁寧語やですます調を使用しないでください。",
    strictToneInstruction:
      "丁寧語の語尾（です・ます・でした など）が一切残らないようにし、各文末を「だ」「である」「ではない」「であった」などの常体で統一してください。",
  },
  desumasu: {
    label: "です・ます調",
    description: "ビジネス文章や丁寧な説明文を想定したスタイル。",
    toneInstruction:
      "文体は常に『です・ます調』に統一し、終止形は「です」「ます」で終わるようにしてください。",
    strictToneInstruction:
      "常体（だ・である 等）の語尾が残らないように確認し、すべての文末を「です」「ます」などの丁寧語で終わらせてください。",
  },
  casual: {
    label: "カジュアル",
    description: "親しみやすいフランクな言い回しに整形します。",
    toneInstruction:
      "くだけた口語表現を使い、友人に話すような親しみやすい文体にしてください。ただし過度に砕けた表現やスラングは避けてください。",
  },
};

export type GeminiTransformRequest = {
  inputText: string;
  writingStyle: WritingStyle;
  punctuationMode: PunctuationMode;
  temperature?: number;
};

export type GeminiTransformResult = {
  outputText: string;
  rawResponse?: unknown;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-lite";
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

function normalizeModelName(model: string): string {
  return model.trim().replace(/^models\//, "").replace(/\s+/g, "-");
}

function resolveGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL;

  if (typeof envModel === "string" && envModel.trim().length > 0) {
    return normalizeModelName(envModel);
  }

  return DEFAULT_GEMINI_MODEL;
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

  if (error.status === 400 && /not found for api version/i.test(error.message)) {
    return true;
  }

  return false;
}

async function requestGeminiApi({
  apiKey,
  model,
  version,
  payload,
  punctuationMode,
}: {
  apiKey: string;
  model: string;
  version: string;
  payload: unknown;
  punctuationMode: PunctuationMode;
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

    throw new GeminiError(`${errorMessage} (model: ${model}, version: ${version})`, {
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
    throw new GeminiError("Gemini API から有効な文章を取得できませんでした。", {
      status: 502,
    });
  }

  return {
    outputText: convertPunctuation(outputText, punctuationMode),
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
      punctuationInstruction = "句読点は必ず半角の「,」「.」を使用してください。";
      break;
    default:
      punctuationInstruction = "句読点は必ず「、」「。」を使用してください。";
      break;
  }

  const instructions: string[] = [
    "- 入力文を大幅に書き換えず、意味や事実関係を保ったまま語尾や表現を整えてください。",
  ];

  if (strictMode && validationDirective && validationDirective.trim().length > 0) {
    instructions.push(`- ${validationDirective.trim()}`);
  }

  instructions.push(`- ${preset.toneInstruction}`);

  if (strictMode && preset.strictToneInstruction) {
    instructions.push(`- ${preset.strictToneInstruction}`);
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
  if (writingStyle !== "dearu") {
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

async function executeGeminiRequest({
  apiKey,
  model,
  apiVersions,
  payload,
  punctuationMode,
}: {
  apiKey: string;
  model: string;
  apiVersions: string[];
  payload: unknown;
  punctuationMode: PunctuationMode;
}): Promise<GeminiTransformResult> {
  const errors: GeminiError[] = [];

  for (const version of apiVersions) {
    try {
      return await requestGeminiApi({
        apiKey,
        model,
        version,
        payload,
        punctuationMode,
      });
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

export async function transformTextWithGemini({
  inputText,
  writingStyle,
  punctuationMode,
  temperature = 0.4,
}: GeminiTransformRequest): Promise<GeminiTransformResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY が設定されていません。", {
      status: 500,
    });
  }

  const model = resolveGeminiModel();
  const apiVersions = resolveGeminiApiVersions();

  const baseTemperature = temperature;
  const attemptConfigs: AttemptConfig[] =
    writingStyle === "dearu"
      ? [
          { strictMode: false, temperature: baseTemperature, enforcementLevel: "standard" },
          {
            strictMode: true,
            temperature: Math.min(baseTemperature, 0.25),
            enforcementLevel: "standard",
          },
        ]
      : [
          { strictMode: false, temperature: baseTemperature, enforcementLevel: "standard" },
        ];

  let validationDirective: string | null = null;
  let validationReason: string | null = null;
  let lastOffendingSentences: string[] = [];

  for (let attemptIndex = 0; attemptIndex < attemptConfigs.length; attemptIndex += 1) {
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
      model,
      apiVersions,
      payload,
      punctuationMode,
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
      writingStyle === "dearu" &&
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
    const errorOptions: { status: number; cause?: { offendingSentences: string[] } } = {
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

const TRAILING_SYMBOLS_PATTERN = /[\s\u3000「」『』（）【】［］〈〉《》｛｝]+$/gu;
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
  if (writingStyle !== "dearu") {
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
  if (writingStyle !== "dearu") {
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

