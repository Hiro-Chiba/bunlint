import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as GeminiModule from "../lib/gemini";
import { POST as aiCheckRoute } from "../app/api/ai-check/route";

const { GeminiError, parseAiCheckerResponse } = GeminiModule;
const ORIGINAL_API_KEY = process.env.GEMINI_API_KEY;
const ORIGINAL_MODEL = process.env.GEMINI_MODEL;

const restoreGeminiModelEnv = () => {
  if (typeof ORIGINAL_MODEL === "string") {
    process.env.GEMINI_MODEL = ORIGINAL_MODEL;
  } else {
    delete process.env.GEMINI_MODEL;
  }
};

describe("parseAiCheckerResponse", () => {
  test("JSONレスポンスを正しく解析する", () => {
    const raw =
      '{"score": 42, "confidence": "medium", "reasoning": "文体に揺らぎがあります"}';
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
    const raw =
      '```json\n{"likelihood": "74", "analysis": "AI特有の語彙が連続しています"}\n```';
    const result = parseAiCheckerResponse(raw);
    assert.equal(result.score, 74);
    assert.equal(result.confidence, "high");
    assert.equal(result.reasoning.includes("AI特有"), true);
  });
});

describe("analyzeAiLikelihoodWithGemini", () => {
  test(
    "Gemini APIの異常応答は例外を送出する",
    { concurrency: false },
    async () => {
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
        restoreGeminiModelEnv();
      }
    },
  );

  test(
    "v1betaがリソース枯渇の場合は同モデルのv1へフォールバックする",
    { concurrency: false },
    async () => {
      process.env.GEMINI_API_KEY = "test-key";
      const originalFetch = globalThis.fetch;
      const callHistory: Array<{ model: string; version: string }> = [];

      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        const [, version, , modelWithSuffix] = url.pathname.split("/");
        const model = modelWithSuffix?.split(":")[0] ?? "";

        callHistory.push({ model, version });

        if (callHistory.length === 1) {
          return new Response(
            JSON.stringify({
              error: { message: "Resource exhausted. Please try again later." },
            }),
            { status: 429 },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"score": 12, "confidence": "low", "reasoning": "テスト"}',
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      };

      try {
        const result = await GeminiModule.analyzeAiLikelihoodWithGemini({
          text: "テキスト",
        });

        assert.deepStrictEqual(result, {
          score: 12,
          confidence: "low",
          reasoning: "テスト",
        });

        assert.deepStrictEqual(callHistory, [
          { version: "v1beta", model: "gemini-2.0-flash-lite" },
          { version: "v1", model: "gemini-2.0-flash-lite" },
        ]);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.GEMINI_API_KEY = ORIGINAL_API_KEY;
        restoreGeminiModelEnv();
      }
    },
  );

  test(
    "Gemini 2.0 Flashが枯渇した場合はFlash-Liteへフォールバックする",
    { concurrency: false },
    async () => {
      process.env.GEMINI_API_KEY = "test-key";
      process.env.GEMINI_MODEL = "gemini-2.0-flash";
      const originalFetch = globalThis.fetch;
      const callHistory: Array<{ model: string; version: string }> = [];

      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        const [, version, , modelWithSuffix] = url.pathname.split("/");
        const model = modelWithSuffix?.split(":")[0] ?? "";

        callHistory.push({ model, version });

        if (callHistory.length <= 2) {
          return new Response(
            JSON.stringify({
              error: { message: "Resource exhausted. Please try again later." },
            }),
            { status: 429 },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"score": 21, "confidence": "medium", "reasoning": "フォールバック成功"}',
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      };

      try {
        const result = await GeminiModule.analyzeAiLikelihoodWithGemini({
          text: "テキスト",
        });

        assert.deepStrictEqual(result, {
          score: 21,
          confidence: "medium",
          reasoning: "フォールバック成功",
        });

        assert.deepStrictEqual(callHistory, [
          { version: "v1beta", model: "gemini-2.0-flash" },
          { version: "v1", model: "gemini-2.0-flash" },
          { version: "v1beta", model: "gemini-2.0-flash-lite" },
        ]);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.GEMINI_API_KEY = ORIGINAL_API_KEY;
        restoreGeminiModelEnv();
      }
    },
  );
});

describe("/api/ai-check", () => {
  const createFetchStub = (result: GeminiModule.AiCheckerResult) => async () =>
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

  test("同日の6回目は429を返す", { concurrency: false }, async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createFetchStub({
      score: 33,
      confidence: "low",
      reasoning: "人間らしさが優勢です",
    });

    try {
      let cookieHeader: string | null = null;

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const request = new Request("http://localhost/api/ai-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookieHeader
              ? { cookie: cookieHeader.split(";")[0] ?? "" }
              : {}),
          },
          body: JSON.stringify({ inputText: "テスト" }),
        });

        const response = await aiCheckRoute(request);
        assert.equal(response.status, 200);
        const setCookie = response.headers.get("set-cookie");
        assert.ok(setCookie && setCookie.includes("ai-check-last-jst"));
        cookieHeader = setCookie;
        const body = (await response.json()) as GeminiModule.AiCheckerResult & {
          checkedAt: string;
          dailyCheckCount: number;
        };
        assert.equal(body.score, 33);
        assert.equal(body.confidence, "low");
        assert.equal(body.dailyCheckCount, attempt);
      }

      const cookieValue = cookieHeader?.split(";")[0] ?? "";
      assert.ok(cookieValue);

      const sixthRequest = new Request("http://localhost/api/ai-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookieValue,
        },
        body: JSON.stringify({ inputText: "テスト" }),
      });

      const sixthResponse = await aiCheckRoute(sixthRequest);
      assert.equal(sixthResponse.status, 429);
      const sixthBody = (await sixthResponse.json()) as {
        error: string;
        lastCheckedAt?: string;
        dailyCheckCount?: number;
      };
      assert.match(sixthBody.error, /1日5回/);
      assert.ok(typeof sixthBody.lastCheckedAt === "string");
      assert.equal(sixthBody.dailyCheckCount, 5);
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
