import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { countCharacters } from "../lib/text";

describe("countCharacters", () => {
  test("結合文字を1文字として数える", () => {
    assert.strictEqual(countCharacters("👍🏼"), 1);
  });

  test("空白を除外できる", () => {
    const text = "テスト  データ";
    assert.strictEqual(countCharacters(text, { excludeWhitespace: true }), 6);
  });
});

