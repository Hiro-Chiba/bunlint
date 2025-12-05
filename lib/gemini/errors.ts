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
