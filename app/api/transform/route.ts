import { NextResponse } from "next/server";

import {
  GeminiError,
  toUserFacingGeminiErrorMessage,
  transformTextWithGemini,
  writingStylePresets,
  type WritingStyle,
} from "@/lib/gemini";
import type { PunctuationMode } from "@/lib/punctuation";

const MAX_INPUT_LENGTH = 4000;

type TransformRequestBody = {
  inputText?: unknown;
  writingStyle?: unknown;
  punctuationMode?: unknown;
};

function isWritingStyle(value: unknown): value is WritingStyle {
  return typeof value === "string" && value in writingStylePresets;
}

function isPunctuationMode(value: unknown): value is PunctuationMode {
  return value === "japanese" || value === "academic" || value === "western";
}

export async function POST(request: Request) {
  let body: TransformRequestBody | null = null;

  try {
    body = (await request.json()) as TransformRequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "リクエストボディの解析に失敗しました。JSON 形式で送信してください。",
      },
      { status: 400 },
    );
  }

  if (!body || typeof body.inputText !== "string") {
    return NextResponse.json(
      { error: "入力テキストが正しく送信されていません。" },
      { status: 400 },
    );
  }

  const trimmedText = body.inputText.trim();
  if (!trimmedText) {
    return NextResponse.json(
      { error: "語尾変換を行うテキストを入力してください。" },
      { status: 400 },
    );
  }

  if (trimmedText.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      {
        error: `テキストが長すぎます。${MAX_INPUT_LENGTH}文字以内に収めてください。`,
      },
      { status: 400 },
    );
  }

  if (!isWritingStyle(body.writingStyle)) {
    return NextResponse.json(
      { error: "指定された語尾スタイルが無効です。" },
      { status: 400 },
    );
  }

  if (!isPunctuationMode(body.punctuationMode)) {
    return NextResponse.json(
      { error: "指定された句読点スタイルが無効です。" },
      { status: 400 },
    );
  }

  try {
    const result = await transformTextWithGemini({
      inputText: trimmedText,
      writingStyle: body.writingStyle,
      punctuationMode: body.punctuationMode,
    });

    const preset = writingStylePresets[body.writingStyle];

    return NextResponse.json({
      outputText: result.outputText,
      writingStyle: body.writingStyle,
      punctuationMode: body.punctuationMode,
      message: `${preset.label}のトーンに整形しました。`,
    });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json(
        { error: toUserFacingGeminiErrorMessage(error) },
        { status: error.status },
      );
    }

    console.error("AI transform failed", error);
    return NextResponse.json(
      { error: "AI変換で予期せぬエラーが発生しました。" },
      { status: 500 },
    );
  }
}
