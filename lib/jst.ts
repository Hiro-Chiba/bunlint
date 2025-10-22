const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJstDate(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

export function getCurrentJstDateKey(date: Date = new Date()): string {
  const jstDate = toJstDate(date);
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNextJstMidnight(date: Date = new Date()): Date {
  const jstDate = toJstDate(date);
  jstDate.setUTCHours(0, 0, 0, 0);
  jstDate.setUTCDate(jstDate.getUTCDate() + 1);
  return new Date(jstDate.getTime() - JST_OFFSET_MS);
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.round(value);
}
