import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeGeminiOutput,
  normalizeWritingStyle,
  validateWritingStyleCompliance,
} from "../lib/gemini";

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
      assert.match(result.directive, /常体に書き換えて/);
      assert.deepStrictEqual(result.offendingSentences, [
        "これはサンプルです。",
      ]);
    }
  });

  test("複数の丁寧語の文をすべて指摘する", () => {
    const result = validateWritingStyleCompliance(
      "最初の文です。次も報告します。最後は常体だ。",
      "dearu",
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepStrictEqual(result.offendingSentences, [
        "最初の文です。",
        "次も報告します。",
      ]);
      assert.ok(result.directive.includes("最初の文です。"));
      assert.ok(result.directive.includes("次も報告します。"));
    }
  });

  test("です・ます調では検証を行わない", () => {
    const result = validateWritingStyleCompliance(
      "これはテストです。報告します。",
      "desumasu",
    );

    assert.deepStrictEqual(result, { ok: true });
  });

  test("人間らしい変換（だ・である）でも常体チェックを行う", () => {
    const result = validateWritingStyleCompliance(
      "最終的な結論である。補足も終わった。",
      "humanize_dearu",
    );

    assert.deepStrictEqual(result, { ok: true });
  });

  test("人間らしい変換（だ・である）に丁寧語が混ざれば失敗する", () => {
    const result = validateWritingStyleCompliance(
      "結論です。補足である。",
      "humanize_dearu",
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.offendingSentences.includes("結論です。"));
    }
  });
});

describe("normalizeGeminiOutput", () => {
  test("だ・である調の冒頭に付く了解メッセージを除去する", () => {
    const normalized = normalizeGeminiOutput(
      "はい、了解しました！ 以下が整えた文章です。これは報告である。",
      "dearu",
    );

    assert.equal(normalized, "これは報告である。");
  });

  test("マークダウンのコードブロックを外して本文のみを返す", () => {
    const normalized = normalizeGeminiOutput(
      "```text\nこれは報告である。\n```",
      "dearu",
    );

    assert.equal(normalized, "これは報告である。");
  });

  test("対象スタイルでない場合は文章を保持する", () => {
    const normalized = normalizeGeminiOutput(
      "了解しました。次に進めます。",
      "desumasu",
    );

    assert.equal(normalized, "了解しました。次に進めます。");
  });

  test("人間らしい変換（だ・である）でも冒頭の了解文を除去する", () => {
    const normalized = normalizeGeminiOutput(
      "了解しました。以下が整えた文章です。これは報告である。",
      "humanize_dearu",
    );

    assert.equal(normalized, "これは報告である。");
  });
});

describe("normalizeWritingStyle", () => {
  test("最新のスタイル名はそのまま返す", () => {
    assert.equal(normalizeWritingStyle("humanize_dearu"), "humanize_dearu");
  });

  test("旧スタイル名humanizeをです・ます変換に読み替える", () => {
    assert.equal(normalizeWritingStyle("humanize"), "humanize_desumasu");
  });
});
