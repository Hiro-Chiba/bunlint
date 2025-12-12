import { GeminiError } from "@/lib/gemini/errors";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterChatParams = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
};

function extractOpenRouterErrorMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    const messageCandidate =
      parsed?.error?.message ?? parsed?.error ?? parsed?.message;

    if (typeof messageCandidate === "string" && messageCandidate.trim()) {
      return messageCandidate.trim();
    }
  } catch {
    // JSONでない場合はそのまま扱う
  }

  const plain = raw.trim();
  return plain.length > 0 ? plain : null;
}

function buildOpenRouterErrorHint(status: number, rawBody: string): string | null {
  const detail = extractOpenRouterErrorMessage(rawBody);
  const base = detail
    ? `OpenRouter API の呼び出しに失敗しました: ${detail}`
    : null;

  if (status === 401) {
    return `${base ?? "OpenRouter API の呼び出しに失敗しました。"} APIキーが無効か、ヘッダーに設定されていない可能性があります。`;
  }

  if (status === 402 || status === 403) {
    return (
      `${base ?? "OpenRouter API の呼び出しに失敗しました。"} ` +
      "無料枠の上限・課金設定、またはモデルの利用許可(Allowlist)を確認してください。"
    );
  }

  return base;
}

export async function callOpenRouterChat({
  model,
  messages,
  temperature,
}: OpenRouterChatParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new GeminiError("OPENROUTER_API_KEY が設定されていません。", {
      status: 500,
      developerCode: "OPENROUTER",
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...(typeof temperature === "number" ? { temperature } : {}),
      response_format: { type: "json_object" },
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    const hint = buildOpenRouterErrorHint(response.status, body);
    throw new GeminiError(
      hint ?? "OpenRouter API の呼び出しに失敗しました。",
      {
        status: response.status,
        cause: body,
        developerCode: "OPENROUTER",
      },
    );
  }

  try {
    const parsed = JSON.parse(body);
    const content: unknown = parsed?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim();
    }
  } catch (error) {
    throw new GeminiError("OpenRouter API のレスポンス解析に失敗しました。", {
      status: 502,
      cause: error,
      developerCode: "OPENROUTER",
    });
  }

  throw new GeminiError("OpenRouter API から有効な応答を取得できませんでした。", {
    status: 502,
    developerCode: "OPENROUTER",
  });
}
