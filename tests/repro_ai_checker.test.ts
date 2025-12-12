import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeAiLikelihoodWithGemini } from "../lib/gemini/index";

const ORIGINAL_OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

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

describe("AI Checker Reproduction", () => {
  it("should not flag formal human-written text as AI", async () => {
    // A formal, academic-style text that might be falsely flagged
    const formalText = `
本報告書では、最新の自然言語処理技術における課題と展望について論じる。
近年、大規模言語モデルの発展は目覚ましいものがあるが、一方でその推論プロセスはブラックボックス化しており、解釈可能性の欠如が指摘されている。
したがって、今後の研究においては、モデルの透明性を高める手法の開発が急務であると言えるだろう。
結論として、技術の進歩と倫理的な側面のバランスを考慮した開発体制の構築が求められる。
    `.trim();

    const originalFetch = globalThis.fetch;
    const responses = [
      createOpenRouterResponse({
        overall_score: 0.2,
        overall_judgement: "low",
        suspicious_segments: [],
        notes: "論旨に揺らぎがありAI兆候は限定的",
      }),
    ];

    process.env.OPENROUTER_API_KEY = "test-openrouter";
    globalThis.fetch = async () => {
      const next = responses.shift();
      if (!next) {
        throw new Error("unexpected fetch call");
      }
      return next;
    };

    try {
      const result = await analyzeAiLikelihoodWithGemini({
        text: formalText,
        temperature: 0.0, // Use 0 for deterministic reproduction
      });

      console.log("Checker Result:", JSON.stringify(result, null, 2));

      // We expect a low score for human text, but user reports high score.
      // This assertion is expected to FAIL if the issue is reproduced.
      // If score > 50, it's considered "AI-like" by the checker.
      assert.ok(result.score < 50, `Expected score < 50, but got ${result.score}. Reasoning: ${result.reasoning}`);
      
    } finally {
      globalThis.fetch = originalFetch;
      process.env.OPENROUTER_API_KEY = ORIGINAL_OPENROUTER_KEY;
    }
  });
});
