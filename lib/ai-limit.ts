import { isSameJstDate } from "./jst";

function normalizeDailyLimit(limit: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(limit));
}

function clampDailyCount(value: number, limit: number): number {
  return Math.max(0, Math.min(Math.floor(value), limit));
}

function normalizeReportedCount(
  reported: unknown,
  limit: number,
): number | null {
  if (typeof reported !== "number" || !Number.isFinite(reported)) {
    return null;
  }

  return clampDailyCount(reported, limit);
}

function normalizePreviousCount(previous: number, limit: number): number {
  if (typeof previous !== "number" || !Number.isFinite(previous)) {
    return 0;
  }

  return clampDailyCount(previous, limit);
}

export function resolveNextDailyCount({
  reportedDailyCount,
  previousCount,
  lastCheckedAt,
  currentCheckedAt,
  dailyLimit,
}: {
  reportedDailyCount: unknown;
  previousCount: number;
  lastCheckedAt: string | null;
  currentCheckedAt: string;
  dailyLimit: number;
}): number {
  const limit = normalizeDailyLimit(dailyLimit);
  const normalizedPrevious = normalizePreviousCount(previousCount, limit);
  const normalizedReported = normalizeReportedCount(reportedDailyCount, limit);
  const hasCheckedOnSameDay =
    typeof lastCheckedAt === "string" &&
    lastCheckedAt &&
    isSameJstDate(lastCheckedAt, currentCheckedAt);

  const localIncrement = hasCheckedOnSameDay
    ? Math.min(normalizedPrevious + 1, limit)
    : 1;

  if (normalizedReported === null) {
    return localIncrement;
  }

  if (!hasCheckedOnSameDay) {
    return Math.max(1, normalizedReported);
  }

  return Math.max(localIncrement, normalizedReported);
}
