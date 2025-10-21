import { describe, expect, test } from "bun:test";

import {
  convertPunctuation,
  detectPunctuationMode,
  toAcademicPunctuation,
  toJapanesePunctuation,
} from "../src/lib/punctuation";

describe("toAcademicPunctuation", () => {
  test("和文向け句読点を学術スタイルに変換する", () => {
    const text = "今日は、良い天気です。";
    expect(toAcademicPunctuation(text)).toBe("今日は，良い天気です．");
  });

  test("既に学術スタイルの句読点は変更しない", () => {
    const text = "今日は，良い天気です．";
    expect(toAcademicPunctuation(text)).toBe(text);
  });
});

describe("toJapanesePunctuation", () => {
  test("学術スタイルを和文向けに変換する", () => {
    const text = "今日は，良い天気です．";
    expect(toJapanesePunctuation(text)).toBe("今日は、良い天気です。");
  });

  test("既に和文スタイルの句読点は変更しない", () => {
    const text = "今日は、良い天気です。";
    expect(toJapanesePunctuation(text)).toBe(text);
  });
});

describe("convertPunctuation", () => {
  test("モードに応じて句読点を変換する", () => {
    const text = "今日は、良い天気です。";
    expect(convertPunctuation(text, "academic")).toBe("今日は，良い天気です．");
    expect(convertPunctuation(text, "japanese")).toBe("今日は、良い天気です。");
  });
});

describe("detectPunctuationMode", () => {
  test("句読点の多数派を返す", () => {
    expect(detectPunctuationMode("今日は，良い天気です．")).toBe("academic");
    expect(detectPunctuationMode("今日は、良い天気です。")).toBe("japanese");
  });

  test("句読点が存在しない場合はjapaneseを返す", () => {
    expect(detectPunctuationMode("今日は良い天気です")).toBe("japanese");
  });

  test("数が同じ場合は和文スタイルを優先する", () => {
    const text = "ここは，和文。ここは、和文。";
    expect(detectPunctuationMode(text)).toBe("japanese");
  });
});
