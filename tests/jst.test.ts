import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { clampScore, getCurrentJstDateKey, getNextJstMidnight } from "../lib/jst";

describe("getCurrentJstDateKey", () => {
  test("UTCの午前でもJSTでは同じ日付になる", () => {
    const date = new Date("2024-03-01T00:30:00.000Z");
    assert.equal(getCurrentJstDateKey(date), "2024-03-01");
  });

  test("UTCの夕方はJSTの翌日として扱われる", () => {
    const date = new Date("2024-03-01T15:30:00.000Z");
    assert.equal(getCurrentJstDateKey(date), "2024-03-02");
  });
});

describe("getNextJstMidnight", () => {
  test("翌日のJST午前0時をUTCに変換して返す", () => {
    const date = new Date("2024-03-01T12:00:00.000Z");
    const nextMidnight = getNextJstMidnight(date);
    assert.equal(nextMidnight.toISOString(), "2024-03-01T15:00:00.000Z");
  });
});

describe("clampScore", () => {
  test("0未満の値は0に丸める", () => {
    assert.equal(clampScore(-12), 0);
  });

  test("100を超える値は100に丸める", () => {
    assert.equal(clampScore(145.2), 100);
  });

  test("小数は四捨五入される", () => {
    assert.equal(clampScore(42.6), 43);
  });
});
