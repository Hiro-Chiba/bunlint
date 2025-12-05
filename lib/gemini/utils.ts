import { type WritingStyle } from "./types";
import {
  writingStylePresets,
  WRITING_STYLE_VALUES,
  LEGACY_WRITING_STYLE_ALIASES,
  LEGACY_WRITING_STYLE_LABELS,
} from "./constants";

export function isWritingStyle(value: unknown): value is WritingStyle {
  return (
    typeof value === "string" &&
    WRITING_STYLE_VALUES.includes(value as WritingStyle)
  );
}

export function normalizeWritingStyle(value: unknown): WritingStyle | null {
  if (isWritingStyle(value)) {
    return value;
  }

  if (typeof value === "string" && value in LEGACY_WRITING_STYLE_ALIASES) {
    return LEGACY_WRITING_STYLE_ALIASES[value];
  }

  return null;
}

export function resolveWritingStyleFromLabel(
  label: unknown,
): WritingStyle | null {
  if (typeof label !== "string" || !label) {
    return null;
  }

  for (const [value, preset] of Object.entries(writingStylePresets) as Array<
    [WritingStyle, (typeof writingStylePresets)[WritingStyle]]
  >) {
    if (preset.label === label) {
      return value;
    }
  }

  if (label in LEGACY_WRITING_STYLE_LABELS) {
    return LEGACY_WRITING_STYLE_LABELS[label];
  }

  return null;
}
