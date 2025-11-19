export const HIGH_ACCURACY_COOKIE_NAME = "bunlint_high_accuracy";
export const HIGH_ACCURACY_DURATION_MS = 10 * 60 * 1000;

const HIGH_ACCURACY_MODEL = "gemini-3-pro-preview";

export function getHighAccuracyModelName(): string {
  return HIGH_ACCURACY_MODEL;
}
