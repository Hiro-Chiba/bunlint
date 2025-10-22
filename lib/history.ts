import "server-only";

import { normalizeWritingStyle, type WritingStyle } from "@/lib/gemini";
import type { PunctuationMode } from "@/lib/punctuation";

import { DatabaseQueryError, type DatabaseClient, getDatabaseClient } from "./db";

type TransformHistoryRow = {
  id: string;
  input_text: string;
  output_text: string | null;
  writing_style: string;
  punctuation_mode: string;
  created_at: string;
};

export type TransformHistoryRecord = {
  id: string;
  inputText: string;
  outputText: string;
  writingStyle: WritingStyle;
  punctuationMode: PunctuationMode;
  createdAt: string;
};

export type CreateHistoryRecordParams = {
  inputText: string;
  outputText: string;
  writingStyle: WritingStyle;
  punctuationMode: PunctuationMode;
};

const PUNCTUATION_MODES: readonly PunctuationMode[] = [
  "academic",
  "japanese",
  "western",
];

const isPunctuationMode = (value: string): value is PunctuationMode =>
  (PUNCTUATION_MODES as readonly string[]).includes(value);

const mapRowToRecord = (
  row: TransformHistoryRow,
): TransformHistoryRecord => {
  const { id, input_text, output_text, writing_style, punctuation_mode, created_at } = row;

  const normalizedStyle = normalizeWritingStyle(writing_style);

  if (!normalizedStyle) {
    throw new DatabaseQueryError(
      `未対応の語尾スタイル値を検出しました: ${writing_style}`,
    );
  }

  if (!isPunctuationMode(punctuation_mode)) {
    throw new DatabaseQueryError(
      `未対応の句読点スタイル値を検出しました: ${punctuation_mode}`,
    );
  }

  const createdAt = new Date(created_at).toISOString();

  return {
    id,
    inputText: input_text,
    outputText: output_text ?? "",
    writingStyle: normalizedStyle,
    punctuationMode: punctuation_mode,
    createdAt,
  };
};

const pruneExpiredHistoryInternal = async (
  client: DatabaseClient,
): Promise<number> => {
  const { rowCount } = await client.query<{ id: string }>(
    "DELETE FROM transform_history WHERE created_at < NOW() - INTERVAL '1 hour' RETURNING id",
  );

  return rowCount;
};

export async function pruneExpiredHistory(
  client: DatabaseClient | null = null,
): Promise<number> {
  const databaseClient = client ?? getDatabaseClient();
  return pruneExpiredHistoryInternal(databaseClient);
}

export async function listRecentHistory(
  limit = 10,
): Promise<TransformHistoryRecord[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new DatabaseQueryError("履歴の取得件数は正の整数で指定してください。");
  }

  const client = getDatabaseClient();
  await pruneExpiredHistoryInternal(client);

  const { rows } = await client.query<TransformHistoryRow>(
    `SELECT id, input_text, output_text, writing_style, punctuation_mode, created_at
     FROM transform_history
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => mapRowToRecord(row));
}

export async function createHistoryRecord(
  params: CreateHistoryRecordParams,
): Promise<TransformHistoryRecord> {
  const { inputText, outputText, writingStyle, punctuationMode } = params;

  const client = getDatabaseClient();
  await pruneExpiredHistoryInternal(client);

  const { rows } = await client.query<TransformHistoryRow>(
    `INSERT INTO transform_history (input_text, output_text, writing_style, punctuation_mode)
     VALUES ($1, $2, $3, $4)
     RETURNING id, input_text, output_text, writing_style, punctuation_mode, created_at`,
    [inputText, outputText, writingStyle, punctuationMode],
  );

  if (!rows[0]) {
    throw new DatabaseQueryError("履歴の保存に失敗しました。");
  }

  return mapRowToRecord(rows[0]);
}

export { DatabaseConfigurationError, DatabaseQueryError } from "./db";
export { HISTORY_RETENTION_MINUTES } from "./history/constants";
