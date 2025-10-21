export type DiffSegmentType = "added" | "removed" | "unchanged";

export type DiffSegment = {
  type: DiffSegmentType;
  value: string;
};

const whitespacePattern = /\s+/g;

const tokenize = (input: string): string[] => {
  if (!input) {
    return [];
  }

  const tokens: string[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(whitespacePattern)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push(input.slice(lastIndex, index));
    }

    tokens.push(match[0]);
    lastIndex = index + match[0].length;
  }

  if (lastIndex < input.length) {
    tokens.push(input.slice(lastIndex));
  }

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
