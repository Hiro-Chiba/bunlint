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

export async function callOpenRouterChat({
  model,
  messages,
  temperature,
}: OpenRouterChatParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new GeminiError("OPENROUTER_API_KEY が設定されていません。", {
      status: 500,
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
    throw new GeminiError("OpenRouter API の呼び出しに失敗しました。", {
      status: response.status,
      cause: body,
    });
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
    });
  }

  throw new GeminiError("OpenRouter API から有効な応答を取得できませんでした。", {
    status: 502,
  });
}
