import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  countCharacters,
  countSentences,
  countWords,
  extractWords,
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
  test("空白で区切られた語数を返す", () => {
    const text = "This  is\n  a\ttest";
    assert.strictEqual(countWords(text), 4);
  });

  test("テキストが空の場合は0を返す", () => {
    assert.strictEqual(countWords("   "), 0);
  });

  test("日本語の文章から内容語数を求める", () => {
    const text = "単語数が少ない問題を修正してください";
    assert.strictEqual(countWords(text), 5);
  });

  test("助詞の境界で内容語を識別する", () => {
    const text = "私は本を読みます";
    assert.strictEqual(countWords(text), 3);
  });

  test("ひらがなだけの語は不必要に分割しない", () => {
    assert.strictEqual(countWords("たべもの"), 1);
  });

  test("かな書きの名詞と助詞の組み合わせから助詞を除外する", () => {
    assert.strictEqual(countWords("おちゃを飲む"), 2);
  });

  test("助詞と助動詞を除外して内容語を数える", () => {
    const text = "これはサンプルテキストです。";
    assert.strictEqual(countWords(text), 2);
  });

  test("句読点や改行が混在していても内容語数を求める", () => {
    const text = "This is a test.\nNew-line text, please!";
    assert.strictEqual(countWords(text), 8);
  });

  test("日本語の読点で区切られた語を正しく数える", () => {
    const text = "「これ，サンプルテキスト，自由，編集，機能，試してください」";
    assert.strictEqual(countWords(text), 6);
  });
});

describe("extractWords", () => {
  test("語のリストを抽出できる", () => {
    const text = "「これ，サンプルテキスト，自由，編集，機能，試してください」";
    assert.deepStrictEqual(extractWords(text), [
      "これ",
      "サンプルテキスト",
      "自由",
      "編集",
      "機能",
      "試してください",
    ]);
  });

  test("助詞と助動詞が取り除かれる", () => {
    const text = "これはサンプルテキストです。";
    assert.deepStrictEqual(extractWords(text), [
      "これ",
      "サンプルテキスト",
    ]);
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
  test("文字数・内容語数・文数をまとめて返す", () => {
    const text = "テストです。This is a test.";
    assert.deepStrictEqual(getTextStats(text), {
      characters: countCharacters(text),
      words: countWords(text),
      sentences: countSentences(text),
    });
  });
});
