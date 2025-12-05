import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_FLASH_MODEL,
  DEFAULT_API_VERSIONS,
} from "./constants";
import { getHighAccuracyModelName } from "../high-accuracy";

function normalizeModelName(model: string): string {
  return model
    .trim()
    .replace(/^models\//, "")
    .replace(/\s+/g, "-");
}

export function resolveGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL;

  if (typeof envModel === "string" && envModel.trim().length > 0) {
    return normalizeModelName(envModel);
  }

  return DEFAULT_GEMINI_MODEL;
}

export function buildModelAttemptOrder({
  baseModel,
  useHighAccuracyModel = false,
}: {
  baseModel: string;
  useHighAccuracyModel?: boolean;
}): string[] {
  const order: string[] = [];
  const normalizedBase = normalizeModelName(baseModel);

  if (useHighAccuracyModel) {
    order.push(getHighAccuracyModelName());
  }

  order.push(normalizedBase);

  if (normalizedBase === DEFAULT_GEMINI_MODEL) {
    order.push(GEMINI_FLASH_MODEL);
  } else if (normalizedBase === GEMINI_FLASH_MODEL) {
    order.push(DEFAULT_GEMINI_MODEL);
  }

  return Array.from(new Set(order.map(normalizeModelName)));
}

export function resolveGeminiApiVersions(): string[] {
  const envVersions = process.env.GEMINI_API_VERSION;

  if (typeof envVersions === "string" && envVersions.trim().length > 0) {
    const versions = envVersions
      .split(",")
      .map((version) => version.trim())
      .filter((version) => version.length > 0);

    if (versions.length > 0) {
      return versions;
    }
  }

  return [...DEFAULT_API_VERSIONS];
}
