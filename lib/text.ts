const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

const whitespacePattern = /\s/u;

export type CharacterCountOptions = {
  /** true の場合、空白文字をカウントから除外する。 */
  excludeWhitespace?: boolean;
};

const splitGraphemes = (text: string): string[] => {
  if (!graphemeSegmenter) {
    return Array.from(text);
  }

  return Array.from(
    graphemeSegmenter.segment(text),
    (segment) => segment.segment,
  );
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

  return characters.filter((char) => !whitespacePattern.test(char)).length;
}
