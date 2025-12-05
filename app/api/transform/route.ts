import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  GeminiError,
  toUserFacingGeminiErrorMessage,
  transformTextWithGemini,
  normalizeWritingStyle,
  writingStylePresets,
} from "@/lib/gemini";
import type { PunctuationMode } from "@/lib/punctuation";
import { HIGH_ACCURACY_COOKIE_NAME } from "@/lib/high-accuracy";
import { verifyHighAccuracyToken } from "@/lib/high-accuracy.server";

const MAX_INPUT_LENGTH = 4000;

type TransformRequestBody = {
  inputText?: unknown;
  writingStyle?: unknown;
  punctuationMode?: unknown;
};

function isPunctuationMode(value: unknown): value is PunctuationMode {
  return value === "japanese" || value === "academic" || value === "western";
}

export async function POST(request: Request) {
  let body: TransformRequestBody | null = null;
  const contentType = request.headers.get("content-type");

  if (!contentType || !/application\/json/i.test(contentType)) {
    return NextResponse.json(
      {
        error: "JSON 形式のリクエストのみ受け付けています。",
      },
      { status: 415 },
    );
  }

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

  const normalizedWritingStyle = normalizeWritingStyle(body.writingStyle);

  if (!normalizedWritingStyle) {
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

  const cookieStore = await cookies();
  const highAccuracySecret = process.env.GEMINI_HIGH_ACCURACY_CODE;
  let useHighAccuracyModel = false;

  if (highAccuracySecret) {
    const token = cookieStore.get(HIGH_ACCURACY_COOKIE_NAME);
    if (token?.value) {
      const verification = verifyHighAccuracyToken(
        token.value,
        highAccuracySecret,
      );

      if (verification) {
        useHighAccuracyModel = true;
      }
    }
  }

  try {
    const result = await transformTextWithGemini({
      inputText: trimmedText,
      writingStyle: normalizedWritingStyle,
      punctuationMode: body.punctuationMode,
      useHighAccuracyModel,
    });

    const preset = writingStylePresets[normalizedWritingStyle];

    return NextResponse.json({
      outputText: result.outputText,
      writingStyle: normalizedWritingStyle,
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
