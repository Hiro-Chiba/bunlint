import { convertPunctuation, type PunctuationMode } from "./punctuation";

export type WritingStyle = "dearu" | "desumasu" | "casual";

export type StylePreset = {
  label: string;
  description: string;
  toneInstruction: string;
};

export const writingStylePresets: Record<WritingStyle, StylePreset> = {
  dearu: {
    label: "だ・である調",
    description: "論文やレポート向けの硬い文体に整えます。",
    toneInstruction:
      "文体は常に『だ・である調』に統一し、丁寧語やですます調を使用しないでください。",
  },
  desumasu: {
    label: "です・ます調",
    description: "ビジネス文章や丁寧な説明文を想定したスタイル。",
    toneInstruction:
      "文体は常に『です・ます調』に統一し、終止形は「です」「ます」で終わるようにしてください。",
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

const GEMINI_MODEL = "gemini-1.5-flash-latest";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

function buildPrompt({
  inputText,
  writingStyle,
  punctuationMode,
}: GeminiTransformRequest): string {
  const preset = writingStylePresets[writingStyle];
  const punctuationInstruction =
    punctuationMode === "academic"
      ? "句読点は必ず「，」「．」を使用してください。"
      : "句読点は必ず「、」「。」を使用してください。";

  return `あなたは日本語文章の編集アシスタントです。以下の指示に従ってテキストを整形してください。

# 指示
- 入力文を大幅に書き換えず、意味や事実関係を保ったまま語尾や表現を整えてください。
- ${preset.toneInstruction}
- ${punctuationInstruction}
- 変換後のテキストのみを出力し、説明文や補足は書かないでください。

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

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt({ inputText, writingStyle, punctuationMode }) },
        ],
      },
    ],
    generationConfig: {
      temperature,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Gemini API の呼び出しに失敗しました (status: ${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.error?.message === "string") {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new GeminiError(errorMessage, { status: response.status });
  }

  const data = await response.json();
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
