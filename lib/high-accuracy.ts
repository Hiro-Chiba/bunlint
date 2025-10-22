import { createHmac, timingSafeEqual } from "node:crypto";

export const HIGH_ACCURACY_COOKIE_NAME = "bunlint_high_accuracy";
export const HIGH_ACCURACY_DURATION_MS = 10 * 60 * 1000;

const HIGH_ACCURACY_MODEL = "gemini-2.5-flash";

type HighAccuracyTokenPayload = {
  expiresAt: string;
  signature: string;
};

function createSignature(expiresAt: string, secret: string): string {
  return createHmac("sha256", secret).update(expiresAt).digest("hex");
}

function safeCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createHighAccuracyToken(
  expiresAt: Date,
  secret: string,
): string {
  const iso = expiresAt.toISOString();
  const payload: HighAccuracyTokenPayload = {
    expiresAt: iso,
    signature: createSignature(iso, secret),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function verifyHighAccuracyToken(
  token: string,
  secret: string,
): { expiresAt: Date } | null {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<HighAccuracyTokenPayload> | null;

    if (!parsed || typeof parsed.expiresAt !== "string") {
      return null;
    }

    const expiresAt = new Date(parsed.expiresAt);

    if (!Number.isFinite(expiresAt.getTime())) {
      return null;
    }

    const expectedSignature = createSignature(parsed.expiresAt, secret);

    if (
      typeof parsed.signature !== "string" ||
      !safeCompare(expectedSignature, parsed.signature)
    ) {
      return null;
    }

    if (expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return { expiresAt };
  } catch {
    return null;
  }
}

export function getHighAccuracyModelName(): string {
  return HIGH_ACCURACY_MODEL;
}
