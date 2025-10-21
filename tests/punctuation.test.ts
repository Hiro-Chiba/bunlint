import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  convertPunctuation,
  detectPunctuationMode,
  replacePunctuationCharacter,
} from "../lib/punctuation";

describe("convertPunctuation", () => {
  test("和文スタイルを指定モードに変換する", () => {
    const text = "今日は、良い天気です。";
    assert.strictEqual(
      convertPunctuation(text, "academic"),
      "今日は，良い天気です．",
    );
    assert.strictEqual(
      convertPunctuation(text, "japanese"),
      "今日は、良い天気です。",
    );
    assert.strictEqual(
      convertPunctuation(text, "western"),
      "今日は,良い天気です.",
    );
  });

  test("学術スタイルを和文・欧文スタイルに変換する", () => {
    const text = "今日は，良い天気です．";
    assert.strictEqual(
      convertPunctuation(text, "japanese"),
      "今日は、良い天気です。",
    );
    assert.strictEqual(
      convertPunctuation(text, "western"),
      "今日は,良い天気です.",
    );
  });

  test("既に対象スタイルの句読点は変更しない", () => {
    const academic = "今日は，良い天気です．";
    const japanese = "今日は、良い天気です。";
    const western = "Here, we use ASCII punctuation.";

    assert.strictEqual(convertPunctuation(academic, "academic"), academic);
    assert.strictEqual(convertPunctuation(japanese, "japanese"), japanese);
    assert.strictEqual(convertPunctuation(western, "western"), western);
  });

  test("混在した句読点も対象スタイルに変換する", () => {
    const text = "混在,テスト。別の，例．";
    assert.strictEqual(
      convertPunctuation(text, "japanese"),
      "混在、テスト。別の、例。",
    );
    assert.strictEqual(
      convertPunctuation(text, "academic"),
      "混在，テスト．別の，例．",
    );
    assert.strictEqual(
      convertPunctuation(text, "western"),
      "混在,テスト.別の,例.",
    );
  });
});

describe("detectPunctuationMode", () => {
  test("句読点の多数派を返す", () => {
    assert.strictEqual(
      detectPunctuationMode("今日は，良い天気です．"),
      "academic",
    );
    assert.strictEqual(
      detectPunctuationMode("今日は、良い天気です。"),
      "japanese",
    );
    assert.strictEqual(
      detectPunctuationMode("Hello, this is western."),
      "western",
    );
  });

  test("句読点が存在しない場合はjapaneseを返す", () => {
    assert.strictEqual(detectPunctuationMode("今日は良い天気です"), "japanese");
  });

  test("数が同じ場合は和文スタイルを優先する", () => {
    const text = "ここは，和文。ここは、和文。";
    assert.strictEqual(detectPunctuationMode(text), "japanese");
  });

  test("3つのスタイルが混在する場合も最多のスタイルを選ぶ", () => {
    const text = "ここは,欧文。ここは，学術。ここは、和文、";
    assert.strictEqual(detectPunctuationMode(text), "japanese");
    const westernDominant = "ここは,欧文.ここは,欧文,終わり。";
    assert.strictEqual(detectPunctuationMode(westernDominant), "western");
  });
});

describe("replacePunctuationCharacter", () => {
  test(
    "指定した記号のみを置換し、他の記号には影響しない",
    () => {
      const input = "A,B。C.D，E．F";
      const result = replacePunctuationCharacter(input, ",", "、");

      assert.strictEqual(result, "A、B。C.D，E．F");
    },
  );

  test("記号が存在しない場合は入力をそのまま返す", () => {
    const input = "これはテストです。";
    const result = replacePunctuationCharacter(input, ",", "、");

    assert.strictEqual(result, input);
  });

  test("変換元と変換先が同じ場合は入力をそのまま返す", () => {
    const input = "。";
    const result = replacePunctuationCharacter(input, "。", "。");

    assert.strictEqual(result, input);
  });
});
