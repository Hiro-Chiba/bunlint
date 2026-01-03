export class GeminiError extends Error {
  status: number;
  developerCode?: string;

  constructor(
    message: string,
    options: { cause?: unknown; status?: number; developerCode?: string } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "GeminiError";
    this.status = options.status ?? 500;
    this.developerCode = options.developerCode;
  }
}

export function toUserFacingGeminiErrorMessage(error: GeminiError): string {
  const normalizedMessage = error.message.toLowerCase();
  const developerCode = error.developerCode
    ? ` (DEV:${error.developerCode})`
    : "";

  if (
    /quota|rate limit|billing/.test(normalizedMessage) ||
    /free[_\s-]?tier/.test(normalizedMessage) ||
    /limit:\s*0/.test(normalizedMessage)
  ) {
    return `AI変換の提供元で利用上限に達しています。時間をおいて、もう一度お試しください。${developerCode}`;
  }

  if (/GEMINI_API_KEY/.test(error.message)) {
    return `AI変換の設定が完了していません。管理者にお問い合わせください。${developerCode}`;
  }

  if (/Gemini/i.test(error.message)) {
    return (
      error.message
        .replace(/Gemini API\s*/gi, "AI変換")
        .replace(/Gemini/gi, "AI") + developerCode
    );
  }

  return `${error.message}${developerCode}`;
}
