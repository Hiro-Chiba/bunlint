export type PunctuationMode = "japanese" | "academic" | "western";

export const punctuationCharacters = [
  "、",
  "。",
  "，",
  "．",
  ",",
  ".",
] as const;

export type PunctuationCharacter = (typeof punctuationCharacters)[number];

const punctuationPattern = /[、。，．,\.]/g;

const academicMap: Record<string, string> = {
  "、": "，",
  "。": "．",
  ",": "，",
  ".": "．",
};

const japaneseMap: Record<string, string> = {
  "，": "、",
  "．": "。",
  ",": "、",
  ".": "。",
};

const westernMap: Record<string, string> = {
  "、": ",",
  "。": ".",
  "，": ",",
  "．": ".",
};

const punctuationMaps: Record<PunctuationMode, Record<string, string>> = {
  academic: academicMap,
  japanese: japaneseMap,
  western: westernMap,
};

const punctuationGroups: Record<PunctuationMode, Set<string>> = {
  academic: new Set(["，", "．"]),
  japanese: new Set(["、", "。"]),
  western: new Set([",", "."]),
};

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replacePunctuationCharacter(
  text: string,
  from: PunctuationCharacter,
  to: PunctuationCharacter,
): string {
  if (from === to) {
    return text;
  }

  const pattern = new RegExp(escapeRegExp(from), "g");
  return text.replace(pattern, to);
}

function replaceWithMap(text: string, map: Record<string, string>): string {
  return text.replace(punctuationPattern, (char) => map[char] ?? char);
}

/**
 * 指定した句読点スタイルにテキストを揃える。
 */
export function convertPunctuation(text: string, mode: PunctuationMode): string {
  const map = punctuationMaps[mode] ?? japaneseMap;
  return replaceWithMap(text, map);
}

/**
 * テキストがどの句読点スタイルを主に用いているかを簡易判定する。
 */
export function detectPunctuationMode(text: string): PunctuationMode {
  const counts: Record<PunctuationMode, number> = {
    academic: 0,
    japanese: 0,
    western: 0,
  };

  for (const char of text) {
    for (const [mode, characters] of Object.entries(punctuationGroups) as Array<
      [PunctuationMode, Set<string>]
    >) {
      if (characters.has(char)) {
        counts[mode] += 1;
        break;
      }
    }
  }

  const total = counts.academic + counts.japanese + counts.western;
  if (total === 0) {
    return "japanese";
  }

  const priorities: PunctuationMode[] = ["japanese", "western", "academic"];
  let result: PunctuationMode = "japanese";
  let maxCount = -1;

  for (const mode of priorities) {
    if (counts[mode] > maxCount) {
      result = mode;
      maxCount = counts[mode];
    }
  }

  return result;
}
