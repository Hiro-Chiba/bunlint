import { convertPunctuation, type PunctuationMode } from "../punctuation";
import { GeminiError } from "./errors";
import { type GeminiTransformResult } from "./types";
import { extractTextFromResponse } from "./parser";

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

export async function requestGeminiApi({
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
        developerCode: "GEMINI_API",
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
        developerCode: "GEMINI_API",
      });
    }
  }

  const outputText = extractTextFromResponse(data);

  if (!outputText) {
    throw new GeminiError("Gemini API から有効な文章を取得できませんでした。", {
      status: 502,
      developerCode: "GEMINI_API",
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

export async function executeGeminiRequest({
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
    developerCode: "GEMINI_API",
  });
}
