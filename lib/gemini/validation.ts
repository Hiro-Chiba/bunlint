import { type WritingStyle } from "./types";
import { DEARU_STYLE_SET } from "./constants";

const isDearuStyle = (style: WritingStyle): boolean =>
  DEARU_STYLE_SET.has(style);

const POLITE_ENDINGS = [
  "です",
  "でした",
  "でしょう",
  "でしょうか",
  "ですよ",
  "ですね",
  "でしょ",
  "でして",
  "でございます",
  "でございました",
  "ます",
  "ました",
  "ません",
  "ませんでした",
  "ませんか",
  "ますか",
  "ましょう",
  "ましょうか",
  "ください",
  "下さい",
  "ございます",
  "ございますか",
];

const TRAILING_SYMBOLS_PATTERN =
  /[\s\u3000「」『』（）【】［］〈〉《》｛｝]+$/gu;
const SENTENCE_DELIMITER_PATTERN = /[^。．\.！？\?]+[。．\.！？\?]?/gu;
const MARKDOWN_CODE_FENCE_START = /^```[^\n]*\n/;
const MARKDOWN_CODE_FENCE_END = /\n```[ \t]*$/;
const ACKNOWLEDGEMENT_KEYWORDS = [
  "了解しました",
  "了承しました",
  "承知しました",
  "承知いたしました",
  "かしこまりました",
  "もちろんです",
  "了解です",
  "了解いたしました",
  "わかりました",
  "分かりました",
  "理解しました",
  "ご確認ください",
  "以下が整えた文章です",
  "以下が整えた文です",
  "以下が変換後の文章です",
  "以下が修正後の文章です",
  "以下に整形後の文章を示します",
  "変換後の文章です",
  "変換後のテキストです",
  "整えた文章です",
  "整形後の文章です",
  "編集結果です",
  "ご確認ください。",
];

function sanitizeSentenceEnding(sentence: string): string {
  return sentence.replace(TRAILING_SYMBOLS_PATTERN, "");
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\r/g, "");
  const sentences: string[] = [];

  for (const block of normalized.split(/\n+/)) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) {
      continue;
    }

    const matches = trimmedBlock.match(SENTENCE_DELIMITER_PATTERN);
    if (matches) {
      for (const match of matches) {
        const sentence = match.trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
      }
      continue;
    }

    sentences.push(trimmedBlock);
  }

  if (sentences.length === 0) {
    const fallback = normalized.trim();
    if (fallback.length > 0) {
      sentences.push(fallback);
    }
  }

  return sentences;
}

function hasPoliteEnding(sentence: string): boolean {
  const withoutEndingSymbols = sanitizeSentenceEnding(sentence);
  const normalized = withoutEndingSymbols
    .replace(/[。．\.！？\?…〜～・、，\s\u3000]+$/gu, "")
    .trim();

  if (!normalized) {
    return false;
  }

  return POLITE_ENDINGS.some((ending) => normalized.endsWith(ending));
}

function normalizeSentenceForDirective(sentence: string): string {
  return sanitizeSentenceEnding(sentence).trim();
}

function buildDearuValidationDirective(sentences: string[]): string {
  const normalizedSentences = sentences
    .map((sentence) => normalizeSentenceForDirective(sentence))
    .filter((sentence) => sentence.length > 0);

  if (normalizedSentences.length === 0) {
    return "丁寧語の語尾を常体に書き換え、最終的な出力では丁寧語を使用しないでください。";
  }

  const bulletList = normalizedSentences
    .map((sentence) => `  - ${sentence}`)
    .join("\n");

  return `以下の文で丁寧語の語尾が残っています。必ず常体に書き換えてください。\n${bulletList}\n  修正後は全文を読み返し、丁寧語が残っていないことを確認してから出力してください。`;
}

type StyleValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      directive: string;
      offendingSentences: string[];
    };

export function validateWritingStyleCompliance(
  text: string,
  writingStyle: WritingStyle,
): StyleValidationResult {
  if (!isDearuStyle(writingStyle)) {
    return { ok: true };
  }

  const sentences = splitIntoSentences(text);
  const violations = sentences.filter((sentence) => hasPoliteEnding(sentence));

  if (violations.length === 0) {
    return { ok: true };
  }

  const normalizedViolations = violations.map((sentence) =>
    normalizeSentenceForDirective(sentence),
  );

  const sampleSource = normalizedViolations[0] ?? violations[0];
  const sample =
    sampleSource.length > 30 ? `${sampleSource.slice(0, 30)}…` : sampleSource;

  return {
    ok: false,
    reason: `だ・である調に統一できませんでした。丁寧語の語尾（です・ます）が残っています（例: 「${sample}」）。`,
    directive: buildDearuValidationDirective(violations),
    offendingSentences: normalizedViolations,
  };
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdownCodeFences(text: string): string {
  if (!text.startsWith("```") || !MARKDOWN_CODE_FENCE_START.test(text)) {
    return text;
  }

  if (!MARKDOWN_CODE_FENCE_END.test(text.trimEnd())) {
    return text;
  }

  return text
    .replace(MARKDOWN_CODE_FENCE_START, "")
    .replace(MARKDOWN_CODE_FENCE_END, "")
    .trim();
}

function removeLeadingAcknowledgementSentences(
  text: string,
  writingStyle: WritingStyle,
): string {
  if (!isDearuStyle(writingStyle)) {
    return text.trim();
  }

  const sentences = splitIntoSentences(text);
  const removableSentences: string[] = [];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) {
      continue;
    }

    const hasKeyword = ACKNOWLEDGEMENT_KEYWORDS.some((keyword) =>
      trimmedSentence.includes(keyword),
    );

    if (!hasKeyword) {
      break;
    }

    if (!hasPoliteEnding(sentence)) {
      break;
    }

    removableSentences.push(trimmedSentence);
  }

  if (removableSentences.length === 0) {
    return text.trim();
  }

  let remainder = text.trimStart();

  for (const sentence of removableSentences) {
    remainder = remainder.trimStart();
    const pattern = new RegExp(
      `^${escapeForRegExp(sentence)}[\s\u3000「」『』（）()【】［］〈〉《》｛｝]*`,
      "u",
    );
    const match = remainder.match(pattern);
    if (!match) {
      break;
    }
    remainder = remainder.slice(match[0].length);
  }

  const trimmedRemainder = remainder.trimStart();
  return trimmedRemainder.length > 0 ? trimmedRemainder : text.trim();
}

export function normalizeGeminiOutput(
  text: string,
  writingStyle: WritingStyle,
): string {
  if (!text) {
    return "";
  }

  let normalized = text.replace(/\r/g, "").trim();

  if (!normalized) {
    return normalized;
  }

  normalized = stripMarkdownCodeFences(normalized);
  normalized = removeLeadingAcknowledgementSentences(normalized, writingStyle);

  return normalized.trim();
}
