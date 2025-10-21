import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  countCharacters,
  countSentences,
  countWords,
  getTextStats,
} from "../lib/text";

describe("countCharacters", () => {
  test("結合文字を1文字として数える", () => {
    assert.strictEqual(countCharacters("👍🏼"), 1);
  });

  test("空白を除外できる", () => {
    const text = "テスト  データ";
    assert.strictEqual(countCharacters(text, { excludeWhitespace: true }), 6);
  });
});

describe("countWords", () => {
  test("空白で区切られた単語数を返す", () => {
    const text = "This  is\n  a\ttest";
    assert.strictEqual(countWords(text), 4);
  });

  test("テキストが空の場合は0を返す", () => {
    assert.strictEqual(countWords("   "), 0);
  });

  test("日本語の文章からも概算の単語数を求める", () => {
    const text = "単語数が少ない問題を修正してください";
    assert.strictEqual(countWords(text), 11);
  });

  test("句読点や改行が混在していても単語数を求める", () => {
    const text = "This is a test.\nNew-line text, please!";
    assert.strictEqual(countWords(text), 8);
  });
});

describe("countSentences", () => {
  test("終端記号で区切られた文を数える", () => {
    const text = "今日は晴れです。明日も晴れるでしょう! 楽しみですね?";
    assert.strictEqual(countSentences(text), 3);
  });

  test("末尾に句読点がなくても文として数える", () => {
    const text = "今日は晴れです。明日も晴れるでしょう でも傘は持っていく";
    assert.strictEqual(countSentences(text), 2);
  });

  test("空白だけの文は無視する", () => {
    const text = "今日は晴れです!     ?";
    assert.strictEqual(countSentences(text), 1);
  });

  test("改行を挟んだ文も数える", () => {
    const text = "こんにちは。\nよろしくお願いします？";
    assert.strictEqual(countSentences(text), 2);
  });

  test("連続する終端記号をまとめて扱う", () => {
    const text = "本当にすごい!?信じられない…。";
    assert.strictEqual(countSentences(text), 2);
  });
});

describe("getTextStats", () => {
  test("文字数・単語数・文数をまとめて返す", () => {
    const text = "テストです。This is a test.";
    assert.deepStrictEqual(getTextStats(text), {
      characters: countCharacters(text),
      words: countWords(text),
      sentences: countSentences(text),
    });
  });
});
