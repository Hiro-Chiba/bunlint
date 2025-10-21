export type PunctuationMode = "japanese" | "academic";

const punctuationPattern = /[、。，．]/g;

const academicMap: Record<string, string> = {
  "、": "，",
  "。": "．",
};

const japaneseMap: Record<string, string> = {
  "，": "、",
  "．": "。",
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
 * 指定した句読点スタイルにテキストを揃える。
 */
export function convertPunctuation(
  text: string,
  mode: PunctuationMode,
): string {
  if (mode === "academic") {
    return toAcademicPunctuation(text);
  }

  return toJapanesePunctuation(text);
}

/**
 * テキストがどの句読点スタイルを主に用いているかを簡易判定する。
 */
export function detectPunctuationMode(text: string): PunctuationMode {
  let academicCount = 0;
  let japaneseCount = 0;

  for (const char of text) {
    if (char === "，" || char === "．") {
      academicCount += 1;
    } else if (char === "、" || char === "。") {
      japaneseCount += 1;
    }
  }

  if (academicCount === 0 && japaneseCount === 0) {
    return "japanese";
  }

  return academicCount > japaneseCount ? "academic" : "japanese";
}
