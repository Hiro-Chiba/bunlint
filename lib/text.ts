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

const ALWAYS_DETACH_PARTICLES = new Set([
  "は",
  "が",
  "を",
  "に",
  "へ",
  "で",
  "と",
]);

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

const FUNCTION_WORD_ALLOW_LIST = new Set<string>([
  ...HIRAGANA_PREFIX_ALLOW_LIST,
  ...PARTICLE_EXCEPTION_WORDS,
]);

const AUXILIARY_WORDS = [
  "だ",
  "だっ",
  "だろ",
  "だろう",
  "です",
  "でし",
  "でした",
  "でしょう",
  "でしょ",
  "でござい",
  "でございます",
  "でござった",
  "ます",
  "まし",
  "ました",
  "ません",
  "ましょう",
  "ましょ",
  "ませ",
  "たい",
  "たく",
  "たかった",
  "たがる",
  "たがっ",
  "たがり",
  "ない",
  "なかっ",
  "なかった",
  "なく",
  "なけれ",
  "なさ",
  "なさい",
  "ぬ",
  "ん",
  "んだ",
  "んです",
  "んですが",
  "んですか",
  "んで",
  "れる",
  "られる",
  "られ",
  "られた",
  "られます",
  "れた",
  "れます",
  "せる",
  "させる",
  "させられる",
  "そう",
  "そうだ",
  "そうです",
  "そうな",
  "そうに",
  "そうで",
  "らしい",
  "らしく",
  "らしさ",
  "よう",
  "ようだ",
  "ように",
  "ような",
  "ようです",
  "みたい",
  "みたいだ",
  "みたいに",
  "みたいな",
  "っぽい",
  "っぽく",
  "っぽさ",
  "げ",
  "げな",
  "げに",
  "がる",
  "がって",
  "がった",
  "がり",
  "ず",
  "まい",
  "べき",
  "べく",
  "べし",
  "しまう",
  "しまった",
  "しまい",
  "ちゃう",
  "ちゃった",
  "じゃう",
  "じゃった",
  "た",
  "たら",
  "たり",
  "たろう",
  "った",
  "って",
  "て",
  "てる",
  "てた",
  "てきた",
  "てしまう",
  "ください",
  "下さい",
  "な",
  "たち",
  "ざる",
  "ざれ",
  "ざら",
];

const AUXILIARY_WORD_SET = new Set(AUXILIARY_WORDS);

const AUXILIARY_MIXED_WORD_SET = new Set(["下さい"]);

const AUXILIARY_SUFFIXES = [
  "くない",
  "くなかった",
  "くなく",
  "すぎる",
  "すぎた",
  "すぎ",
  "づらい",
  "づらく",
  "づらかった",
  "にくい",
  "にくく",
  "にくかった",
  "がたい",
  "がたく",
  "がたかった",
  "させる",
  "させられる",
  "させられ",
  "される",
  "され",
  "させて",
  "されて",
  "たち",
  "ちゃう",
  "ちゃった",
  "じゃう",
  "じゃった",
  "っぽい",
  "っぽく",
  "っぽさ",
];

const CONJUNCTION_WORDS = [
  "そして",
  "しかし",
  "しかしながら",
  "だけど",
  "だけれども",
  "だが",
  "ですが",
  "だから",
  "なので",
  "ゆえに",
  "よって",
  "それで",
  "それでも",
  "それなのに",
  "それなら",
  "それでは",
  "すると",
  "ところが",
  "しかも",
  "さらに",
  "および",
  "及び",
  "ならびに",
  "並びに",
  "かつ",
  "もしくは",
  "または",
  "あるいは",
  "一方",
  "一方で",
];

const CONJUNCTION_WORD_SET = new Set(CONJUNCTION_WORDS);

const INTERJECTION_WORDS = [
  "はい",
  "いいえ",
  "うん",
  "ええ",
  "ああ",
  "おお",
  "わあ",
  "へえ",
  "おや",
  "まあ",
  "やあ",
  "おっ",
  "おっと",
  "あっ",
  "おい",
  "ねえ",
  "ほら",
  "よし",
  "ふう",
  "はあ",
];

const INTERJECTION_WORD_SET = new Set(INTERJECTION_WORDS);

const punctuationLikePattern = /^[\p{Punctuation}\p{Symbol}]+$/u;

function splitGraphemes(text: string): string[] {
  if (!graphemeSegmenter) {
    return Array.from(text);
  }

  return Array.from(
    graphemeSegmenter.segment(text),
    (segment) => segment.segment,
  );
}

type SegmentKind =
  | "kanji"
  | "hiragana"
  | "katakana"
  | "latin"
  | "number"
  | "other";

const katakanaPattern = /^(?:\p{Script=Katakana}|ー)+$/u;
const latinPattern = /^\p{Letter}+$/u;
const numberPattern = /^\p{Number}+$/u;

const hiraganaParticleCandidates = new Set([
  "か",
  "も",
  "の",
  "や",
  "ね",
  "よ",
  "ぞ",
  "さ",
  "わ",
]);

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

    if (
      bufferType !== type &&
      !(bufferType === "kanji" && type === "hiragana")
    ) {
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

function mergeSegments(values: SegmentEntry[]): string[] {
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

  for (const entry of values) {
    const { value, breakBefore } = entry;
    if (!value) {
      continue;
    }

    if (breakBefore) {
      flushBuffer();
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

      if (
        bufferType === "kanji" &&
        !breakBefore &&
        /\p{Script=Hiragana}/u.test(buffer) &&
        (value === "て" || value === "で")
      ) {
        buffer += value;
        bufferType = "hiragana";
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

type SegmentEntry = {
  value: string;
  breakBefore: boolean;
};

function buildWordsFromSegments(segments: SegmentEntry[]): string[] {
  if (segments.length === 0) {
    return [];
  }

  const merged = mergeSegments(segments);
  const separated = separateParticles(merged);
  return separated.filter((token) => token.length > 0);
}

function collectWordsUsingSegmenter(text: string): SegmentEntry[] {
  if (!wordSegmenter) {
    return [];
  }

  const rawSegments = Array.from(wordSegmenter.segment(text));
  const entries: SegmentEntry[] = [];
  let previousEnd = 0;
  let hasPreviousWord = false;

  for (const segment of rawSegments) {
    if (!segment.isWordLike) {
      continue;
    }

    const rawValue = segment.segment;
    let startOffset = 0;
    let endOffset = rawValue.length;

    while (startOffset < endOffset && /\s/u.test(rawValue[startOffset]!)) {
      startOffset += 1;
    }

    while (endOffset > startOffset && /\s/u.test(rawValue[endOffset - 1]!)) {
      endOffset -= 1;
    }

    if (startOffset === endOffset) {
      continue;
    }

    const value = rawValue.slice(startOffset, endOffset);
    const trimmedStart = segment.index + startOffset;
    const trimmedEnd = segment.index + endOffset;
    const breakBefore = hasPreviousWord && trimmedStart > previousEnd;

    entries.push({ value, breakBefore });
    hasPreviousWord = true;
    previousEnd = trimmedEnd;
  }

  return entries;
}

function collectWordsWithFallback(text: string): SegmentEntry[] {
  const matches = text.matchAll(fallbackWordPattern);
  const entries: SegmentEntry[] = [];
  let previousEnd = 0;
  let hasPreviousMatch = false;

  for (const match of matches) {
    const value = match[0];
    if (!value) {
      continue;
    }

    const index = match.index;
    if (typeof index !== "number") {
      continue;
    }

    const breakBefore = hasPreviousMatch && index > previousEnd;
    entries.push({ value, breakBefore });
    hasPreviousMatch = true;
    previousEnd = index + value.length;
  }

  return entries;
}

function splitWords(text: string): string[] {
  const segmented = collectWordsUsingSegmenter(text);
  if (segmented.length > 0) {
    return buildWordsFromSegments(segmented);
  }

  return buildWordsFromSegments(collectWordsWithFallback(text));
}

function shouldTreatParticleAsContent(
  token: string,
  _previousToken: string | null,
  nextToken: string | null,
): boolean {
  if (token === "よ") {
    if (nextToken && /^か/u.test(nextToken)) {
      return true;
    }
  }

  return false;
}

function isAuxiliaryToken(
  token: string,
  previousToken: string | null,
): boolean {
  if (FUNCTION_WORD_ALLOW_LIST.has(token)) {
    return false;
  }

  if (AUXILIARY_WORD_SET.has(token) || AUXILIARY_MIXED_WORD_SET.has(token)) {
    if (token === "した" && previousToken !== "で") {
      return false;
    }

    return true;
  }

  if (!hiraganaOnlyPattern.test(token)) {
    return false;
  }

  for (const suffix of AUXILIARY_SUFFIXES) {
    if (token.endsWith(suffix) && token.length > suffix.length) {
      return true;
    }
  }

  if (token === "した" && previousToken === "で") {
    return true;
  }

  return false;
}

function isFunctionWord(
  token: string,
  previousToken: string | null,
  nextToken: string | null,
): boolean {
  const trimmed = token.trim();
  if (!trimmed) {
    return true;
  }

  if (punctuationLikePattern.test(trimmed)) {
    return true;
  }

  if (!isJapaneseWord(trimmed)) {
    return false;
  }

  if (PARTICLE_SET.has(trimmed)) {
    if (shouldTreatParticleAsContent(trimmed, previousToken, nextToken)) {
      return false;
    }

    return true;
  }

  if (CONJUNCTION_WORD_SET.has(trimmed)) {
    return true;
  }

  if (INTERJECTION_WORD_SET.has(trimmed)) {
    return true;
  }

  if (FUNCTION_WORD_ALLOW_LIST.has(trimmed)) {
    return false;
  }

  return isAuxiliaryToken(trimmed, previousToken);
}

function filterContentWords(tokens: string[]): string[] {
  const filtered: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    const previous = index > 0 ? tokens[index - 1] ?? null : null;
    const next = index + 1 < tokens.length ? tokens[index + 1] ?? null : null;

    if (!isFunctionWord(token, previous, next)) {
      filtered.push(token);
    }
  }

  return filtered;
}

export type TextStats = {
  /** 文字数。結合文字やサロゲートペアも1文字としてカウントする。 */
  characters: number;
  /** 内容語数。助詞や助動詞などの機能語を除いた語の数。 */
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
 * 内容語のリストを抽出する。Intl.Segmenterが利用可能な場合は語の境界を推定し、
 * それ以外の環境では空白や句読点で区切ったトークンを用いる。
 * 助詞・助動詞などの機能語はフィルタリングする。
 */
export function extractWords(text: string): string[] {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return [];
  }

  const words = splitWords(normalized);
  if (words.length > 0) {
    return filterContentWords(words);
  }

  const tokens = normalized.match(/\S+/gu);
  return filterContentWords(tokens ?? []);
}

/**
 * 内容語数をカウントする。Intl.Segmenterが利用可能な場合は語の境界を推定し、
 * それ以外の環境では空白や句読点で区切ったトークンを用いる。
 */
export function countWords(text: string): number {
  return extractWords(text).length;
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
 * 文字数・内容語数・文数をまとめて返す。
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
