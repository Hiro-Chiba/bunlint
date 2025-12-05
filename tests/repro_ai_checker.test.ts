import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeAiLikelihoodWithGemini } from "../lib/gemini";

describe("AI Checker Reproduction", () => {
  it("should not flag formal human-written text as AI", async () => {
    // A formal, academic-style text that might be falsely flagged
    const formalText = `
本報告書では、最新の自然言語処理技術における課題と展望について論じる。
近年、大規模言語モデルの発展は目覚ましいものがあるが、一方でその推論プロセスはブラックボックス化しており、解釈可能性の欠如が指摘されている。
したがって、今後の研究においては、モデルの透明性を高める手法の開発が急務であると言えるだろう。
結論として、技術の進歩と倫理的な側面のバランスを考慮した開発体制の構築が求められる。
    `.trim();

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
      
    } catch (error) {
      // If API key is missing, skip test or fail gracefully
      if (error instanceof Error && error.message.includes("GEMINI_API_KEY")) {
        console.warn("Skipping test: GEMINI_API_KEY not set");
        return;
      }
      throw error;
    }
  });
});
