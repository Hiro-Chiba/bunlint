import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  convertPunctuation,
  detectPunctuationMode,
  toAcademicPunctuation,
  toJapanesePunctuation,
  toWesternPunctuation,
} from "../lib/punctuation";

describe("toAcademicPunctuation", () => {
  test("和文向け句読点を学術スタイルに変換する", () => {
    const text = "今日は、良い天気です。";
    assert.strictEqual(toAcademicPunctuation(text), "今日は，良い天気です．");
  });

  test("既に学術スタイルの句読点は変更しない", () => {
    const text = "今日は，良い天気です．";
    assert.strictEqual(toAcademicPunctuation(text), text);
  });
});

describe("toJapanesePunctuation", () => {
  test("学術スタイルを和文向けに変換する", () => {
    const text = "今日は，良い天気です．";
    assert.strictEqual(toJapanesePunctuation(text), "今日は、良い天気です。");
  });

  test("既に和文スタイルの句読点は変更しない", () => {
    const text = "今日は、良い天気です。";
    assert.strictEqual(toJapanesePunctuation(text), text);
  });
});

describe("toWesternPunctuation", () => {
  test("和文・学術スタイルを半角句読点に変換する", () => {
    const text = "ここは、和文です。ここは，学術です．";
    assert.strictEqual(
      toWesternPunctuation(text),
      "ここは,和文です.ここは,学術です.",
    );
  });

  test("既に半角句読点は変更しない", () => {
    const text = "Here, we use ASCII punctuation.";
    assert.strictEqual(toWesternPunctuation(text), text);
  });
});

describe("convertPunctuation", () => {
  test("モードに応じて句読点を変換する", () => {
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
