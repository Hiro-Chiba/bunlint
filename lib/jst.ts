export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toDate(value: Date | string | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  return null;
}

export function toJstDateString(value: Date | string | number): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  const jstTime = new Date(date.getTime() + JST_OFFSET_MS);
  return jstTime.toISOString().slice(0, 10);
}

export function isSameJstDate(
  first: Date | string | number,
  second: Date | string | number,
): boolean {
  const firstDate = toJstDateString(first);
  const secondDate = toJstDateString(second);

  if (!firstDate || !secondDate) {
    return false;
  }

  return firstDate === secondDate;
}

export function getNextJstMidnight(reference: Date = new Date()): Date {
  const jstReference = new Date(reference.getTime() + JST_OFFSET_MS);

  const nextJstMidnightUtc =
    Date.UTC(
      jstReference.getUTCFullYear(),
      jstReference.getUTCMonth(),
      jstReference.getUTCDate() + 1,
    ) - JST_OFFSET_MS;

  return new Date(nextJstMidnightUtc);
}
