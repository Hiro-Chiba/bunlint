import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  convertPunctuation,
  detectPunctuationMode,
  toAcademicPunctuation,
  toJapanesePunctuation,
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

describe("convertPunctuation", () => {
  test("モードに応じて句読点を変換する", () => {
    const text = "今日は、良い天気です。";
    assert.strictEqual(convertPunctuation(text, "academic"), "今日は，良い天気です．");
    assert.strictEqual(convertPunctuation(text, "japanese"), "今日は、良い天気です。");
  });
});

describe("detectPunctuationMode", () => {
  test("句読点の多数派を返す", () => {
    assert.strictEqual(detectPunctuationMode("今日は，良い天気です．"), "academic");
    assert.strictEqual(detectPunctuationMode("今日は、良い天気です。"), "japanese");
  });

  test("句読点が存在しない場合はjapaneseを返す", () => {
    assert.strictEqual(detectPunctuationMode("今日は良い天気です"), "japanese");
  });

  test("数が同じ場合は和文スタイルを優先する", () => {
    const text = "ここは，和文。ここは、和文。";
    assert.strictEqual(detectPunctuationMode(text), "japanese");
  });
});
