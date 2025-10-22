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

const fallbackWordPattern = new RegExp(
  [
    "\\p{Script=Han}+(?:\\p{Script=Hiragana}+)*",
    "\\p{Script=Katakana}+(?:ー+)*",
    "\\p{Script=Hiragana}+",
    "[\\p{Letter}\\p{Number}\\p{Mark}'’_-]+",
  ].join("|"),
  "gu",
);

const japaneseWordPattern =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;

const hiraganaOnlyPattern = /^\p{Script=Hiragana}+$/u;

const ALWAYS_DETACH_PARTICLES = new Set(["は", "が", "を", "に", "へ", "で", "と"]);

const PARTICLE_LIST = [
  "なんて",
  "なんか",
  "ながら",
  "だらけ",
  "ばかり",
  "かしら",
  "かも",
  "でも",
  "ても",
  "にも",
  "とも",
  "から",
  "まで",
  "より",
  "だけ",
  "ほど",
  "くらい",
  "ぐらい",
  "など",
  "なり",
  "やら",
  "って",
  "たり",
  "とか",
  "さえ",
  "すら",
  "しか",
  "ずつ",
  "か",
  "も",
  "の",
  "や",
  "ね",
  "よ",
  "ぞ",
  "さ",
  "わ",
  "は",
  "が",
  "を",
  "に",
  "へ",
  "で",
  "と",
];

const PARTICLE_SET = new Set(PARTICLE_LIST);
const SORTED_PARTICLES = [...PARTICLE_SET].sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

const HIRAGANA_PREFIX_ALLOW_LIST = new Set([
  "これ",
  "それ",
  "あれ",
  "どれ",
  "どの",
  "この",
  "その",
  "あの",
  "ここ",
  "そこ",
  "あそこ",
  "どこ",
  "こちら",
  "そちら",
  "あちら",
  "どちら",
  "こっち",
  "そっち",
  "あっち",
  "どっち",
  "これら",
  "それら",
  "あれら",
  "どれら",
  "こいつ",
  "そいつ",
  "あいつ",
  "どいつ",
  "なに",
  "なん",
  "なぜ",
  "いつ",
  "どれほど",
  "どれくらい",
  "どれぐらい",
  "わたし",
  "わたしたち",
  "あなた",
  "あなたたち",
  "ぼく",
  "ぼくら",
  "きみ",
  "きみたち",
  "おれ",
  "おれたち",
  "われ",
  "われわれ",
  "みんな",
  "みな",
  "みなさん",
  "それぞれ",
  "うち",
  "なにか",
  "なにも",
  "いつか",
  "いつも",
  "なぜか",
  "どこか",
  "どこでも",
]);

const PARTICLE_EXCEPTION_WORDS = new Set([
  "いつも",
  "いつか",
  "いつまでも",
  "なんでも",
  "なんとなく",
  "なぜか",
  "なかなか",
  "なにか",
  "なにも",
  "どこか",
  "どこでも",
  "そこそこ",
  "そのまま",
  "どれくらい",
  "どれぐらい",
]);

function splitGraphemes(text: string): string[] {
  if (!graphemeSegmenter) {
    return Array.from(text);
  }

  return Array.from(
    graphemeSegmenter.segment(text),
    (segment) => segment.segment,
  );
}

type SegmentKind = "kanji" | "hiragana" | "katakana" | "latin" | "number" | "other";

const katakanaPattern = /^(?:\p{Script=Katakana}|ー)+$/u;
const latinPattern = /^\p{Letter}+$/u;
const numberPattern = /^\p{Number}+$/u;

const hiraganaParticleCandidates = new Set(["か", "も", "の", "や", "ね", "よ", "ぞ", "さ", "わ"]);

function isJapaneseWord(value: string): boolean {
  return japaneseWordPattern.test(value);
}

function detectSegmentKind(value: string): SegmentKind {
  if (/\p{Script=Han}/u.test(value)) {
    return "kanji";
  }

  if (hiraganaOnlyPattern.test(value)) {
    return "hiragana";
  }

  if (katakanaPattern.test(value)) {
    return "katakana";
  }

  if (latinPattern.test(value)) {
    return "latin";
  }

  if (numberPattern.test(value)) {
    return "number";
  }

  return "other";
}

function beginsWithParticle(value: string): boolean {
  for (const particle of SORTED_PARTICLES) {
    if (value.startsWith(particle)) {
      return true;
    }
  }

  return false;
}

function matchTrailingParticle(value: string): string | null {
  for (const particle of SORTED_PARTICLES) {
    if (value.endsWith(particle)) {
      return particle;
    }
  }

  return null;
}

function splitByScript(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  const segments: string[] = [];
  let buffer = "";
  let bufferType: SegmentKind | null = null;

  for (let index = 0; index < value.length; ) {
    const char = value[index];
    const type = detectSegmentKind(char);

    if (!buffer) {
      buffer = char;
      bufferType = type;
      index += char.length;
      continue;
    }

    if (
      (bufferType === "kanji" || bufferType === "katakana") &&
      type === "hiragana" &&
      beginsWithParticle(value.slice(index))
    ) {
      segments.push(buffer);
      buffer = char;
      bufferType = type;
      index += char.length;
      continue;
    }

    if (bufferType !== type && !(bufferType === "kanji" && type === "hiragana")) {
      segments.push(buffer);
      buffer = char;
      bufferType = type;
      index += char.length;
      continue;
    }

    buffer += char;
    bufferType = type;
    index += char.length;
  }

  if (buffer) {
    segments.push(buffer);
  }

  return segments;
}

type ParticleSplitResult = {
  tokens: string[];
  sawContent: boolean;
};

function canExtractTrailingParticle(
  prefix: string,
  particle: string,
  hasContent: boolean,
): boolean {
  const combined = prefix + particle;
  if (PARTICLE_EXCEPTION_WORDS.has(combined)) {
    return false;
  }

  const prefixHasKanji = /\p{Script=Han}/u.test(prefix);
  const prefixHasKatakana = /\p{Script=Katakana}/u.test(prefix);
  const prefixHasLatin = /\p{Letter}/u.test(prefix);
  const prefixInAllowList = HIRAGANA_PREFIX_ALLOW_LIST.has(prefix);
  const prefixIsParticle = prefix.length === 1 && PARTICLE_SET.has(prefix);
  const prefixWillBecomeWord =
    prefix.length > 0 && (!PARTICLE_SET.has(prefix) || prefix.length > 1);

  const effectiveContent =
    hasContent ||
    prefixHasKanji ||
    prefixHasKatakana ||
    prefixHasLatin ||
    prefixInAllowList ||
    prefixWillBecomeWord;

  if (prefix.length === 0) {
    return hasContent;
  }

  if (ALWAYS_DETACH_PARTICLES.has(particle)) {
    return effectiveContent || prefixIsParticle;
  }

  if (particle === "の") {
    if (prefixHasKanji || prefixHasKatakana || prefixInAllowList) {
      return true;
    }

    if (prefixIsParticle && effectiveContent) {
      return true;
    }

    return false;
  }

  if (particle === "も") {
    if (prefixHasKanji || prefixHasKatakana || prefixInAllowList) {
      return true;
    }

    if (prefixIsParticle) {
      return effectiveContent;
    }

    return false;
  }

  if (hiraganaParticleCandidates.has(particle)) {
    if (prefixHasKanji || prefixHasKatakana || prefixInAllowList) {
      return true;
    }

    if (prefixIsParticle) {
      return effectiveContent;
    }

    return false;
  }

  if (particle.length > 1) {
    return effectiveContent;
  }

  return effectiveContent;
}

function splitHiraganaSegment(
  segment: string,
  hasContent: boolean,
): ParticleSplitResult {
  let remaining = segment;
  const extracted: string[] = [];
  let sawContent = hasContent;

  while (remaining.length > 0) {
    const particle = matchTrailingParticle(remaining);
    if (!particle) {
      break;
    }

    const prefix = remaining.slice(0, remaining.length - particle.length);
    if (!canExtractTrailingParticle(prefix, particle, sawContent)) {
      break;
    }

    extracted.unshift(particle);
    remaining = prefix;
  }

  const tokens: string[] = [];
  if (remaining.length > 0) {
    tokens.push(remaining);
    if (!PARTICLE_SET.has(remaining)) {
      sawContent = true;
    }
  }

  for (const particle of extracted) {
    tokens.push(particle);
  }

  return { tokens, sawContent };
}

function splitTokenConsideringParticles(
  token: string,
  hasContent: boolean,
): ParticleSplitResult {
  if (!isJapaneseWord(token)) {
    return { tokens: [token], sawContent: true };
  }

  const segments = splitByScript(token);
  const tokens: string[] = [];
  let sawContent = hasContent;

  for (const segment of segments) {
    if (!segment) {
      continue;
    }

    if (hiraganaOnlyPattern.test(segment)) {
      const result = splitHiraganaSegment(segment, sawContent);
      tokens.push(...result.tokens);
      sawContent = result.sawContent;
      continue;
    }

    tokens.push(segment);
    if (!PARTICLE_SET.has(segment)) {
      sawContent = true;
    }
  }

  return { tokens, sawContent };
}

function mergeSegments(values: string[]): string[] {
  const merged: string[] = [];
  let buffer = "";
  let bufferType: SegmentKind | null = null;

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }

    merged.push(buffer);
    buffer = "";
    bufferType = null;
  };

  for (const value of values) {
    if (!value) {
      continue;
    }

    const type = detectSegmentKind(value);

    if (type === "hiragana") {
      if (PARTICLE_SET.has(value)) {
        flushBuffer();
        merged.push(value);
        continue;
      }

      if (bufferType === "hiragana") {
        buffer += value;
        continue;
      }

      flushBuffer();
      buffer = value;
      bufferType = "hiragana";
      continue;
    }

    if (type === "kanji" || type === "katakana") {
      if (bufferType === type) {
        buffer += value;
        continue;
      }

      flushBuffer();
      buffer = value;
      bufferType = type;
      continue;
    }

    flushBuffer();
    merged.push(value);
  }

  flushBuffer();
  return merged;
}

function separateParticles(values: string[]): string[] {
  const result: string[] = [];
  let sawContent = false;

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    if (!isJapaneseWord(trimmed)) {
      result.push(trimmed);
      sawContent = true;
      continue;
    }

    const splitResult = splitTokenConsideringParticles(trimmed, sawContent);
    result.push(...splitResult.tokens);
    sawContent = splitResult.sawContent;
  }

  return result;
}

function buildWordsFromSegments(segments: string[]): string[] {
  if (segments.length === 0) {
    return [];
  }

  const merged = mergeSegments(segments);
  const separated = separateParticles(merged);
  return separated.filter((token) => token.length > 0);
}

function collectWordsUsingSegmenter(text: string): string[] {
  if (!wordSegmenter) {
    return [];
  }

  const rawSegments = Array.from(wordSegmenter.segment(text));
  const wordLikeValues = rawSegments
    .filter((segment) => segment.isWordLike)
    .map((segment) => segment.segment.trim())
    .filter((segment) => segment.length > 0);

  return buildWordsFromSegments(wordLikeValues);
}

function collectWordsWithFallback(text: string): string[] {
  const matches = text.match(fallbackWordPattern);
  if (!matches) {
    return [];
  }

  return buildWordsFromSegments(matches);
}

function splitWords(text: string): string[] {
  const segmented = collectWordsUsingSegmenter(text);
  if (segmented.length > 0) {
    return segmented;
  }

  return collectWordsWithFallback(text);
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
