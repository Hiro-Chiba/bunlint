import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { diffWords } from "../lib/diff";

describe("diffWords", () => {
  test("空文字列同士は空配列を返す", () => {
    assert.deepStrictEqual(diffWords("", ""), []);
  });

  test("同一文字列はunchangedのみを返す", () => {
    assert.deepStrictEqual(diffWords("テスト", "テスト"), [
      { type: "unchanged", value: "テスト" },
    ]);
  });

  test("追加された単語がaddedとして検出される", () => {
    assert.deepStrictEqual(
      diffWords("こんにちは 世界", "こんにちは 新しい 世界"),
      [
        { type: "unchanged", value: "こんにちは " },
        { type: "added", value: "新しい " },
        { type: "unchanged", value: "世界" },
      ],
    );
  });

  test("削除された単語がremovedとして検出される", () => {
    assert.deepStrictEqual(
      diffWords("こんにちは 新しい 世界", "こんにちは 世界"),
      [
        { type: "unchanged", value: "こんにちは " },
        { type: "removed", value: "新しい " },
        { type: "unchanged", value: "世界" },
      ],
    );
  });

  test("改行を含む差分でも追加部分を保持する", () => {
    assert.deepStrictEqual(diffWords("行1\n行2", "行1\n新しい行\n行2"), [
      { type: "unchanged", value: "行1\n" },
      { type: "added", value: "新しい行\n" },
      { type: "unchanged", value: "行2" },
    ]);
  });
});
