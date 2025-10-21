import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validateWritingStyleCompliance } from "../lib/gemini";

describe("validateWritingStyleCompliance", () => {
  test("だ・である調の文末が常体で統一されていれば成功する", () => {
    const result = validateWritingStyleCompliance(
      "これはテストである。以上だ。",
      "dearu",
    );

    assert.deepStrictEqual(result, { ok: true });
  });

  test("だ・である調に丁寧語が混ざると失敗する", () => {
    const result = validateWritingStyleCompliance(
      "これはサンプルです。報告は以上である。",
      "dearu",
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /丁寧語/);
      assert.match(result.directive, /文末/);
    }
  });

  test("です・ます調では検証を行わない", () => {
    const result = validateWritingStyleCompliance(
      "これはテストです。報告します。",
      "desumasu",
    );

    assert.deepStrictEqual(result, { ok: true });
  });
});
