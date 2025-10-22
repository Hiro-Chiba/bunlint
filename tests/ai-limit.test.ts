import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveNextDailyCount } from "../lib/ai-limit";

describe("resolveNextDailyCount", () => {
  test("サーバーの値がなくても日次カウントを進める", () => {
    const result = resolveNextDailyCount({
      reportedDailyCount: undefined,
      previousCount: 1,
      lastCheckedAt: "2024-05-01T01:00:00.000Z",
      currentCheckedAt: "2024-05-01T03:00:00.000Z",
      dailyLimit: 5,
    });

    assert.equal(result, 2);
  });

  test("サーバー値が小さい場合でもカウントを巻き戻さない", () => {
    const result = resolveNextDailyCount({
      reportedDailyCount: 1,
      previousCount: 2,
      lastCheckedAt: "2024-05-01T00:00:00.000Z",
      currentCheckedAt: "2024-05-01T05:00:00.000Z",
      dailyLimit: 5,
    });

    assert.equal(result, 3);
  });

  test("上限を超えるサーバー値は上限で丸める", () => {
    const result = resolveNextDailyCount({
      reportedDailyCount: 99,
      previousCount: 3,
      lastCheckedAt: "2024-05-01T02:00:00.000Z",
      currentCheckedAt: "2024-05-01T04:00:00.000Z",
      dailyLimit: 5,
    });

    assert.equal(result, 5);
  });

  test("日付が変わった場合はカウントをリセットする", () => {
    const result = resolveNextDailyCount({
      reportedDailyCount: undefined,
      previousCount: 5,
      lastCheckedAt: "2024-05-01T14:30:00.000Z",
      currentCheckedAt: "2024-05-01T15:30:00.000Z",
      dailyLimit: 5,
    });

    assert.equal(result, 1);
  });
});
