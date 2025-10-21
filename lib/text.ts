const SENTENCE_DELIMITERS = ["。", "．", ".", "!", "?", "！", "？"] as const;

const escapedDelimiterClass = SENTENCE_DELIMITERS.map((char) =>
  char.replace(/[\\^$*+?.()|[\]{}-]/g, "\\$&"),
).join("");

const delimiterRegex = new RegExp(`[${escapedDelimiterClass}]`, "gu");
const sentencePattern = new RegExp(
  `[^${escapedDelimiterClass}]+(?:[${escapedDelimiterClass}]+|$)`,
  "gu",
);

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

const wordSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "word" })
    : null;

function splitGraphemes(text: string): string[] {
  if (!graphemeSegmenter) {
    return Array.from(text);
  }

  return Array.from(
    graphemeSegmenter.segment(text),
    (segment) => segment.segment,
  );
}

function splitWords(text: string): string[] {
  if (wordSegmenter) {
    const segments = wordSegmenter.segment(text);
    const words: string[] = [];

    for (const segment of segments) {
      if (!segment.isWordLike) {
        continue;
      }

      const normalized = segment.segment.trim();
      if (normalized.length === 0) {
        continue;
      }

      words.push(normalized);
    }

    if (words.length > 0) {
      return words;
    }
  }

  return (
    text.match(
      /\p{Script=Han}|\p{Script=Hiragana}+|\p{Script=Katakana}+|[\p{Letter}\p{Number}\p{Mark}'’_-]+/gu,
    ) ?? []
  ).filter((word) => word.trim().length > 0);
}

export type TextStats = {
  /** 文字数。結合文字やサロゲートペアも1文字としてカウントする。 */
  characters: number;
  /** 単語数。空白文字で分割したトークンの数を返す。 */
  words: number;
  /** 文の数。句読点・終端記号で区切った文を数える。 */
  sentences: number;
};

export type CharacterCountOptions = {
  /** true の場合、空白文字をカウントから除外する。 */
  excludeWhitespace?: boolean;
};

/**
 * 文字数をカウントする。結合文字や絵文字も1文字として扱う。
 */
export function countCharacters(
  text: string,
  options: CharacterCountOptions = {},
): number {
  const { excludeWhitespace = false } = options;
  const characters = splitGraphemes(text);
  if (!excludeWhitespace) {
    return characters.length;
  }

  return characters.filter((char) => !/\s/u.test(char)).length;
}

/**
 * 単語数をカウントする。Intl.Segmenterが利用可能な場合は単語境界を推定し、
 * それ以外の環境では空白や句読点で区切ったトークン数を用いる。
 */
export function countWords(text: string): number {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return 0;
  }

  const words = splitWords(normalized);
  if (words.length > 0) {
    return words.length;
  }

  const tokens = normalized.match(/\S+/gu);
  return tokens ? tokens.length : 0;
}

/**
 * 文の数をカウントする。終端記号（。．.!?！？）で区切り、余分な空白のみの文は除外する。
 */
export function countSentences(text: string): number {
  const normalized = text.replace(/[\r\n]+/g, " ").trim();
  if (!normalized) {
    return 0;
  }

  const segments = normalized.match(sentencePattern);
  if (!segments) {
    return 0;
  }

  return segments.filter((segment) => {
    const content = segment.replace(delimiterRegex, "").trim();
    return content.length > 0;
  }).length;
}

/**
 * 文字数・単語数・文数をまとめて返す。
 */
export function getTextStats(
  text: string,
  options: CharacterCountOptions = {},
): TextStats {
  return {
    characters: countCharacters(text, options),
    words: countWords(text),
    sentences: countSentences(text),
  };
}
