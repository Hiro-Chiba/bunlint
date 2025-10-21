import { convertPunctuation, type PunctuationMode } from "./punctuation";

export type WritingStyle = "dearu" | "desumasu" | "casual";

export type StylePreset = {
  label: string;
  description: string;
  toneInstruction: string;
  strictToneInstruction?: string;
};

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
};

function buildPrompt({
  inputText,
  writingStyle,
  punctuationMode,
  strictMode = false,
  validationDirective,
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

  if (strictMode) {
    instructions.push(
      "- 出力前に文体の揺れが残っていないか自己チェックし、丁寧語と常体が混在しないようにしてください。",
    );
  }

  return `あなたは日本語文章の編集アシスタントです。以下の指示に従ってテキストを整形してください。

# 指示
${instructions.join("\n")}

# 入力文
${inputText.trim()}`;
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

  const attemptConfigs: Array<{ strictMode: boolean; temperature: number }> =
    writingStyle === "dearu"
      ? [
          { strictMode: false, temperature },
          { strictMode: true, temperature: Math.min(temperature, 0.2) },
        ]
      : [{ strictMode: false, temperature }];

  let validationDirective: string | null = null;
  let validationReason: string | null = null;

  for (const attempt of attemptConfigs) {
    const payload = createGeminiPayload({
      inputText,
      writingStyle,
      punctuationMode,
      temperature: attempt.temperature,
      strictMode: attempt.strictMode,
      validationDirective,
    });

    const result = await executeGeminiRequest({
      apiKey,
      model,
      apiVersions,
      payload,
      punctuationMode,
    });

    const validation = validateWritingStyleCompliance(
      result.outputText,
      writingStyle,
    );

    if (validation.ok) {
      return result;
    }

    validationDirective = validation.directive;
    validationReason = validation.reason;
  }

  if (validationReason) {
    throw new GeminiError(validationReason, { status: 502 });
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

type StyleValidationResult =
  | { ok: true }
  | { ok: false; reason: string; directive: string };

export function validateWritingStyleCompliance(
  text: string,
  writingStyle: WritingStyle,
): StyleValidationResult {
  if (writingStyle !== "dearu") {
    return { ok: true };
  }

  const sentences = splitIntoSentences(text);
  const violation = sentences.find((sentence) => hasPoliteEnding(sentence));

  if (!violation) {
    return { ok: true };
  }

  const sample = violation.length > 30 ? `${violation.slice(0, 30)}…` : violation;

  return {
    ok: false,
    reason: `だ・である調に統一できませんでした。丁寧語の語尾（です・ます）が残っています（例: 「${sample}」）。`,
    directive:
      "丁寧語の語尾（です・ます）が残っています。すべての文末を「だ」「である」「ではない」「であった」などの常体に統一してください。",
  };
}

