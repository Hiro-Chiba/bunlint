export type PunctuationMode = "japanese" | "academic" | "western";

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

const punctuationGroups: Record<PunctuationMode, Set<string>> = {
  academic: new Set(["，", "．"]),
  japanese: new Set(["、", "。"]),
  western: new Set([",", "."]),
};

function replaceWithMap(text: string, map: Record<string, string>): string {
  return text.replace(punctuationPattern, (char) => map[char] ?? char);
}

/**
 * 和文向けの句読点（、。）を学術論文などで用いられるスタイル（，．）に変換する。
 */
export function toAcademicPunctuation(text: string): string {
  return replaceWithMap(text, academicMap);
}

/**
 * 学術論文スタイルの句読点（，．）を和文向けの句読点（、。）に変換する。
 */
export function toJapanesePunctuation(text: string): string {
  return replaceWithMap(text, japaneseMap);
}

/**
 * 欧文向けの句読点（,.）に変換する。
 */
export function toWesternPunctuation(text: string): string {
  return replaceWithMap(text, westernMap);
}

/**
 * 指定した句読点スタイルにテキストを揃える。
 */
export function convertPunctuation(text: string, mode: PunctuationMode): string {
  if (mode === "academic") {
    return toAcademicPunctuation(text);
  }

  if (mode === "western") {
    return toWesternPunctuation(text);
  }

  return toJapanesePunctuation(text);
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
