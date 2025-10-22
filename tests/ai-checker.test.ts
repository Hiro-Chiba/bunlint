import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { describeAiLikelihood, parseAiCheckerModelOutput } from "../lib/ai-checker";
import { GeminiError } from "../lib/gemini";

describe("parseAiCheckerModelOutput", () => {
  test("JSON文字列を解析してスコアと説明を取得する", () => {
    const raw = '{"ai_likelihood_percent": 42, "explanation": "語彙が人間らしいため低めです。"}';
    const result = parseAiCheckerModelOutput(raw);
    assert.deepEqual(result, {
      score: 42,
      explanation: "語彙が人間らしいため低めです。",
    });
  });

  test("コードブロック形式のレスポンスでも解析できる", () => {
    const raw = "```json\n{\"score\": \"87\", \"explanation\": \"AI特有の整然さが見られます。\"}\n```";
    const result = parseAiCheckerModelOutput(raw);
    assert.deepEqual(result, {
      score: 87,
      explanation: "AI特有の整然さが見られます。",
    });
  });

  test("スコアは0から100に丸め込まれる", () => {
    const resultHigh = parseAiCheckerModelOutput(
      '{"score": 132.4, "explanation": "AIらしさが顕著です。"}',
    );
    assert.deepEqual(resultHigh, {
      score: 100,
      explanation: "AIらしさが顕著です。",
    });

    const resultLow = parseAiCheckerModelOutput(
      '{"ai_likelihood_percent": -12, "explanation": "人間味が強いです。"}',
    );
    assert.deepEqual(resultLow, {
      score: 0,
      explanation: "人間味が強いです。",
    });
  });

  test("説明が欠落しているときはエラーを投げる", () => {
    assert.throws(
      () => parseAiCheckerModelOutput('{"ai_likelihood_percent": 30}'),
      (error) => error instanceof GeminiError,
    );
  });

  test("JSONを抽出できない場合はエラー", () => {
    assert.throws(
      () => parseAiCheckerModelOutput("AI判定結果: 40%"),
      (error) => error instanceof GeminiError,
    );
  });
});

describe("describeAiLikelihood", () => {
  test("スコア40未満は人間らしいと判断する", () => {
    assert.equal(describeAiLikelihood(25), "人間が執筆した可能性が高い");
  });

  test("中間のスコアは中程度と表示する", () => {
    assert.equal(describeAiLikelihood(55), "AI生成の可能性は中程度");
  });

  test("高スコアはAI生成の可能性が高いと表示する", () => {
    assert.equal(describeAiLikelihood(82), "AI生成の可能性が高い");
  });
});
