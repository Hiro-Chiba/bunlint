import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as GeminiModule from "../lib/gemini";
import { POST as aiCheckRoute } from "../app/api/ai-check/route";

const { GeminiError, parseAiCheckerResponse } = GeminiModule;
const ORIGINAL_API_KEY = process.env.GEMINI_API_KEY;

describe("parseAiCheckerResponse", () => {
  test("JSONレスポンスを正しく解析する", () => {
    const raw = '{"score": 42, "confidence": "medium", "reasoning": "文体に揺らぎがあります"}';
    const result = parseAiCheckerResponse(raw);
    assert.deepStrictEqual(result, {
      score: 42,
      confidence: "medium",
      reasoning: "文体に揺らぎがあります",
    });
  });

  test("信頼度が欠ける場合はスコアから推定する", () => {
    const raw = '{"score": 85, "reasoning": "AIの定型表現が多い"}';
    const result = parseAiCheckerResponse(raw);
    assert.equal(result.confidence, "high");
    assert.equal(result.reasoning.includes("AI"), true);
  });

  test("コードフェンス付きのJSONでも解析できる", () => {
    const raw = "```json\n{\"likelihood\": \"74\", \"analysis\": \"AI特有の語彙が連続しています\"}\n```";
    const result = parseAiCheckerResponse(raw);
    assert.equal(result.score, 74);
    assert.equal(result.confidence, "high");
    assert.equal(result.reasoning.includes("AI特有"), true);
  });
});

describe("analyzeAiLikelihoodWithGemini", () => {
  test("Gemini APIの異常応答は例外を送出する", { concurrency: false }, async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("invalid", { status: 200 });

    try {
      await assert.rejects(
        () => GeminiModule.analyzeAiLikelihoodWithGemini({ text: "test" }),
        (error: unknown) => {
          assert.equal(error instanceof GeminiError, true);
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      process.env.GEMINI_API_KEY = ORIGINAL_API_KEY;
    }
  });
});

describe("/api/ai-check", () => {
  const createFetchStub = (result: GeminiModule.AiCheckerResult) =>
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(result),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );

  test("同日の2回目は429を返す", { concurrency: false }, async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createFetchStub({
      score: 33,
      confidence: "low",
      reasoning: "人間らしさが優勢です",
    });

    try {
      const request = new Request("http://localhost/api/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: "テスト" }),
      });

      const firstResponse = await aiCheckRoute(request.clone());
      assert.equal(firstResponse.status, 200);
      const cookieHeader = firstResponse.headers.get("set-cookie");
      assert.ok(cookieHeader && cookieHeader.includes("ai-check-last-jst"));
      const body = (await firstResponse.json()) as GeminiModule.AiCheckerResult & {
        checkedAt: string;
      };
      assert.equal(body.score, 33);
      assert.equal(body.confidence, "low");

      const cookieValue = cookieHeader.split(";")[0]?.split("=")[1] ?? "";

      const secondRequest = new Request("http://localhost/api/ai-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `ai-check-last-jst=${cookieValue}`,
        },
        body: JSON.stringify({ inputText: "テスト" }),
      });

      const secondResponse = await aiCheckRoute(secondRequest);
      assert.equal(secondResponse.status, 429);
      const secondBody = (await secondResponse.json()) as {
        error: string;
        lastCheckedAt?: string;
      };
      assert.match(secondBody.error, /1日1回/);
      assert.ok(typeof secondBody.lastCheckedAt === "string");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.GEMINI_API_KEY = ORIGINAL_API_KEY;
    }
  });

  test("空文字列は400で拒否される", { concurrency: false }, async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createFetchStub({
      score: 10,
      confidence: "low",
      reasoning: "入力が短すぎます",
    });

    try {
      const request = new Request("http://localhost/api/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: "" }),
      });

      const response = await aiCheckRoute(request);
      assert.equal(response.status, 400);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.GEMINI_API_KEY = ORIGINAL_API_KEY;
    }
  });
});
