import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as GeminiModule from "../lib/gemini/index";
import { POST as aiCheckRoute } from "../app/api/ai-check/route";

const { GeminiError, parseAiCheckerResponse } = GeminiModule;
const ORIGINAL_OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const ORIGINAL_GEMINI_KEY = process.env.GEMINI_API_KEY;

const restoreEnv = (key: string, value: string | undefined) => {
  if (typeof value === "string") {
    process.env[key] = value;
    return;
  }

  delete process.env[key];
};

const createOpenRouterResponse = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(content),
          },
        },
      ],
    }),
    { status: 200 },
  );

describe("parseAiCheckerResponse", () => {
  test("Gemini新フォーマットを解析できる", () => {
    const raw = JSON.stringify({
      overall_score: 0.72,
      overall_judgement: "high",
      suspicious_segments: [],
      notes: "ばらつきが少ない文体",
    });
    const result = parseAiCheckerResponse(raw);
    assert.deepStrictEqual(result, {
      score: 72,
      confidence: "high",
      reasoning: "ばらつきが少ない文体",
    });
  });

  test("旧来フォーマットも後方互換で解析する", () => {
    const raw = '{"score": 42, "reasoning": "テスト"}';
    const result = parseAiCheckerResponse(raw);
    assert.equal(result.score, 42);
    assert.equal(result.confidence, "medium");
    assert.equal(result.reasoning, "テスト");
  });
});

describe("analyzeAiLikelihoodWithGemini", () => {
  test("GeminiとNovaの統合スコアを計算する", { concurrency: false }, async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter";
    const originalFetch = globalThis.fetch;
    const responses = [
      createOpenRouterResponse({
        overall_score: 0.8,
        overall_judgement: "high",
        suspicious_segments: [
          { segment_id: 1, location: "1行目", reason: "均質な語尾", score: 0.7 },
          { segment_id: 2, location: "2行目", reason: "テンプレ感", score: 0.5 },
        ],
        notes: "均質性が高い文章",
      }),
      createOpenRouterResponse({
        segment_id: 1,
        secondary_score: 0.6,
        agreement: true,
        reason: "多少ぎこちないが自然",
      }),
      createOpenRouterResponse({
        segment_id: 2,
        secondary_score: 0.4,
        agreement: false,
        reason: "人間でもあり得る",
      }),
    ];

    globalThis.fetch = async () => {
      const next = responses.shift();
      assert.ok(next, "fetch calls exceeded stubs");
      return next;
    };

    try {
      const result = await GeminiModule.analyzeAiLikelihoodWithGemini({
        text: "テスト本文",
      });

      assert.equal(result.score, 68);
      assert.equal(result.confidence, "high");
      assert.ok(result.reasoning.includes("最終スコアは68点"));
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv("OPENROUTER_API_KEY", ORIGINAL_OPENROUTER_KEY);
    }
  });

  test("OpenRouterの異常応答は例外を送出する", { concurrency: false }, async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter";
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
      restoreEnv("OPENROUTER_API_KEY", ORIGINAL_OPENROUTER_KEY);
    }
  });

  test("OpenRouterキーなしでも既存Geminiロジックで動作する", { concurrency: false }, async () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.GEMINI_API_KEY = "test-gemini";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '{"score": 55, "reasoning": "fallback"}' }],
              },
            },
          ],
        }),
        { status: 200 },
      );

    try {
      const result = await GeminiModule.analyzeAiLikelihoodWithGemini({
        text: "フォールバックテスト",
      });

      assert.equal(result.score, 55);
      assert.equal(result.confidence, "medium");
      assert.equal(result.reasoning, "fallback");
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv("OPENROUTER_API_KEY", ORIGINAL_OPENROUTER_KEY);
      restoreEnv("GEMINI_API_KEY", ORIGINAL_GEMINI_KEY);
    }
  });
});

describe("/api/ai-check", () => {
  const mainPayload = {
    overall_score: 0.33,
    overall_judgement: "low",
    suspicious_segments: [
      { segment_id: 1, location: "1行目", reason: "AIっぽさ", score: 0.33 },
    ],
    notes: "控えめなAI兆候",
  };
  const novaPayload = {
    segment_id: 1,
    secondary_score: 0.33,
    agreement: true,
    reason: "自然な文体",
  };

  const createFetchStub = () => {
    let toggle = false;
    return async () => {
      toggle = !toggle;
      return toggle
        ? createOpenRouterResponse(mainPayload)
        : createOpenRouterResponse(novaPayload);
    };
  };

  test("同日の6回目は429を返す", { concurrency: false }, async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createFetchStub();

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

      const request = new Request("http://localhost/api/ai-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader.split(";")[0] ?? "" } : {}),
        },
        body: JSON.stringify({ inputText: "テスト" }),
      });

      const response = await aiCheckRoute(request);
      assert.equal(response.status, 429);
      const body = (await response.json()) as { error: string };
      assert.ok(body.error.includes("5回"));
    } finally {
      globalThis.fetch = originalFetch;
      process.env.OPENROUTER_API_KEY = ORIGINAL_OPENROUTER_KEY;
    }
  });
});
