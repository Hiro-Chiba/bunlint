import { NextResponse } from "next/server";

import {
  createHistoryRecord,
  listRecentHistory,
  DatabaseConfigurationError,
  DatabaseQueryError,
  HISTORY_RETENTION_MINUTES,
} from "@/lib/history";
import { normalizeWritingStyle } from "@/lib/gemini";
import type { PunctuationMode } from "@/lib/punctuation";

const MAX_HISTORY_LIMIT = 50;

const isPunctuationMode = (value: unknown): value is PunctuationMode =>
  value === "japanese" || value === "academic" || value === "western";

const createErrorResponse = (message: string, status = 500) =>
  NextResponse.json({ error: message }, { status });

type HistoryRequestBody = {
  inputText?: unknown;
  outputText?: unknown;
  writingStyle?: unknown;
  punctuationMode?: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  let limit = 10;

  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_HISTORY_LIMIT);
    }
  }

  try {
    const history = await listRecentHistory(limit);
    return NextResponse.json({
      history,
      retentionMinutes: HISTORY_RETENTION_MINUTES,
    });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return createErrorResponse(error.message, 500);
    }

    if (error instanceof DatabaseQueryError) {
      console.error("Failed to fetch transform history", error);
      return createErrorResponse("履歴の取得に失敗しました。", 500);
    }

    console.error("Unexpected error while fetching history", error);
    return createErrorResponse(
      "履歴の取得中に予期せぬエラーが発生しました。",
      500,
    );
  }
}

export async function POST(request: Request) {
  let body: HistoryRequestBody;

  try {
    body = (await request.json()) as HistoryRequestBody;
  } catch {
    return createErrorResponse(
      "リクエストボディの解析に失敗しました。JSON 形式で送信してください。",
      400,
    );
  }

  if (typeof body.inputText !== "string") {
    return createErrorResponse("入力テキストが指定されていません。", 400);
  }

  const normalizedWritingStyle = normalizeWritingStyle(body.writingStyle);

  if (!normalizedWritingStyle) {
    return createErrorResponse("語尾スタイルの指定が無効です。", 400);
  }

  if (!isPunctuationMode(body.punctuationMode)) {
    return createErrorResponse("句読点スタイルの指定が無効です。", 400);
  }

  const inputText = body.inputText;
  const outputText =
    typeof body.outputText === "string" ? body.outputText : "";

  try {
    const history = await createHistoryRecord({
      inputText,
      outputText,
      writingStyle: normalizedWritingStyle,
      punctuationMode: body.punctuationMode,
    });

    return NextResponse.json(
      { history, retentionMinutes: HISTORY_RETENTION_MINUTES },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return createErrorResponse(error.message, 500);
    }

    if (error instanceof DatabaseQueryError) {
      console.error("Failed to store transform history", error);
      return createErrorResponse("履歴の保存に失敗しました。", 500);
    }

    console.error("Unexpected error while storing history", error);
    return createErrorResponse(
      "履歴の保存中に予期せぬエラーが発生しました。",
      500,
    );
  }
}
