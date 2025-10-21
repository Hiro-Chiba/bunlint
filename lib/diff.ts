export type DiffSegmentType = "added" | "removed" | "unchanged";

export type DiffSegment = {
  type: DiffSegmentType;
  value: string;
};

const whitespaceRegex = /\s/;
const japaneseCharRegex =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const asciiWordRegex = /[A-Za-z0-9]/;

const tokenize = (input: string): string[] => {
  if (!input) {
    return [];
  }

  const tokens: string[] = [];
  let asciiBuffer = "";

  const flushAsciiBuffer = () => {
    if (asciiBuffer) {
      tokens.push(asciiBuffer);
      asciiBuffer = "";
    }
  };

  for (const char of Array.from(input)) {
    if (whitespaceRegex.test(char)) {
      flushAsciiBuffer();
      tokens.push(char);
      continue;
    }

    if (japaneseCharRegex.test(char)) {
      flushAsciiBuffer();
      tokens.push(char);
      continue;
    }

    if (asciiWordRegex.test(char)) {
      asciiBuffer += char;
      continue;
    }

    flushAsciiBuffer();
    tokens.push(char);
  }

  flushAsciiBuffer();

  return tokens;
};

const pushSegment = (
  segments: DiffSegment[],
  type: DiffSegmentType,
  value: string,
) => {
  if (!value) {
    return;
  }

  const last = segments.at(-1);
  if (last && last.type === type) {
    last.value += value;
    return;
  }

  segments.push({ type, value });
};

export const diffWords = (original: string, updated: string): DiffSegment[] => {
  const originalTokens = tokenize(original);
  const updatedTokens = tokenize(updated);

  const originalLength = originalTokens.length;
  const updatedLength = updatedTokens.length;

  const lcsMatrix: number[][] = Array.from({ length: originalLength + 1 }, () =>
    new Array<number>(updatedLength + 1).fill(0),
  );

  for (let i = originalLength - 1; i >= 0; i -= 1) {
    for (let j = updatedLength - 1; j >= 0; j -= 1) {
      if (originalTokens[i] === updatedTokens[j]) {
        lcsMatrix[i][j] = lcsMatrix[i + 1][j + 1] + 1;
      } else {
        lcsMatrix[i][j] = Math.max(lcsMatrix[i + 1][j], lcsMatrix[i][j + 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < originalLength && j < updatedLength) {
    if (originalTokens[i] === updatedTokens[j]) {
      pushSegment(segments, "unchanged", originalTokens[i]);
      i += 1;
      j += 1;
      continue;
    }

    if (lcsMatrix[i + 1][j] >= lcsMatrix[i][j + 1]) {
      pushSegment(segments, "removed", originalTokens[i]);
      i += 1;
    } else {
      pushSegment(segments, "added", updatedTokens[j]);
      j += 1;
    }
  }

  while (i < originalLength) {
    pushSegment(segments, "removed", originalTokens[i]);
    i += 1;
  }

  while (j < updatedLength) {
    pushSegment(segments, "added", updatedTokens[j]);
    j += 1;
  }

  return segments;
};
