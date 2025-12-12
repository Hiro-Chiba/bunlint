import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GeminiError, toUserFacingGeminiErrorMessage } from "../lib/gemini/errors";

describe("toUserFacingGeminiErrorMessage", () => {
  test("利用上限超過エラーを日本語で案内する", () => {
    const error = new GeminiError(
      "You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0",
      { status: 429 },
    );

    const message = toUserFacingGeminiErrorMessage(error);

    assert.equal(
      message,
      "AI変換の提供元で利用上限に達しています。時間をおいて再度お試しください。",
    );
  });

  test("Geminiという単語をAIに置き換える", () => {
    const error = new GeminiError("Gemini API failure", { status: 500 });

    const message = toUserFacingGeminiErrorMessage(error);

    assert.equal(message, "AI変換failure");
  });

  test("開発者向けコードでOpenRouter利用を示す", () => {
    const error = new GeminiError("OpenRouter API の呼び出しに失敗しました。", {
      status: 502,
      developerCode: "OPENROUTER",
    });

    const message = toUserFacingGeminiErrorMessage(error);

    assert.equal(message, "OpenRouter API の呼び出しに失敗しました。 (DEV:OPENROUTER)");
  });

  test("Gemini API利用時の上限超過に開発者向けコードを付与する", () => {
    const error = new GeminiError(
      "Gemini API quota exceeded: limit: 0",
      {
        status: 429,
        developerCode: "GEMINI_API",
      },
    );

    const message = toUserFacingGeminiErrorMessage(error);

    assert.equal(
      message,
      "AI変換の提供元で利用上限に達しています。時間をおいて再度お試しください。 (DEV:GEMINI_API)",
    );
  });
});
