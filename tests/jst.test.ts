import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  JST_OFFSET_MS,
  getNextJstMidnight,
  isSameJstDate,
  toJstDateString,
} from "../lib/jst";

describe("toJstDateString", () => {
  test("UTCの午後が翌日のJST日付に変換される", () => {
    const utcDate = new Date(Date.UTC(2024, 0, 1, 15, 0, 0));
    assert.equal(toJstDateString(utcDate), "2024-01-02");
  });

  test("無効な入力はnullを返す", () => {
    assert.equal(toJstDateString("invalid"), null);
  });
});

describe("isSameJstDate", () => {
  test("JST日付が同じ場合はtrue", () => {
    const first = new Date(Date.UTC(2024, 4, 10, 14, 0, 0));
    const second = new Date(first.getTime() + 30 * 60 * 1000);
    assert.equal(isSameJstDate(first, second), true);
  });

  test("UTCでは同日でもJSTで日付が変わればfalse", () => {
    const first = new Date(Date.UTC(2024, 4, 10, 2, 0, 0));
    const second = new Date(first.getTime() - 12 * 60 * 60 * 1000);
    assert.equal(isSameJstDate(first, second), false);
  });
});

describe("getNextJstMidnight", () => {
  test("次のJST深夜が常に基準時刻より後になる", () => {
    const reference = new Date(Date.UTC(2024, 4, 10, 12, 0, 0));
    const nextMidnight = getNextJstMidnight(reference);
    assert.ok(nextMidnight.getTime() > reference.getTime());
  });

  test("JSTの深夜がUTCへ正しく変換される", () => {
    const reference = new Date(Date.UTC(2024, 4, 10, 18, 0, 0));
    const nextMidnight = getNextJstMidnight(reference);
    const jstDate = toJstDateString(nextMidnight);
    assert.equal(jstDate, "2024-05-12");
  });
});
