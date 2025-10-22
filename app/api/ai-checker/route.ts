import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { describeAiLikelihood, evaluateAiLikelihood } from "@/lib/ai-checker";
import { GeminiError } from "@/lib/gemini";
import { clampScore, getCurrentJstDateKey, getNextJstMidnight } from "@/lib/jst";

const COOKIE_NAME = "bunlint_ai_checker_last_run";
const MAX_INPUT_LENGTH = 4000;

type AiCheckerRequestBody = {
  inputText?: unknown;
};

function toUserFacingErrorMessage(error: GeminiError): string {
  if (/GEMINI_API_KEY/.test(error.message)) {
    return "AIチェッカーの設定が完了していません。管理者にお問い合わせください。";
  }

  if (/Gemini/i.test(error.message)) {
    return error.message
      .replace(/Gemini API\s*/gi, "AIチェッカー")
      .replace(/Gemini/gi, "AIチェッカー");
  }

  return error.message;
}

export async function POST(request: Request) {
  let body: AiCheckerRequestBody | null = null;

  try {
    body = (await request.json()) as AiCheckerRequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "リクエストボディの解析に失敗しました。JSON形式で入力テキストを送信してください。",
      },
      { status: 400 },
    );
  }

  if (!body || typeof body.inputText !== "string") {
    return NextResponse.json(
      { error: "AIチェッカーを実行するテキストが指定されていません。" },
      { status: 400 },
    );
  }

  const trimmedText = body.inputText.trim();
  if (!trimmedText) {
    return NextResponse.json(
      { error: "AIチェッカーを実行するテキストを入力してください。" },
      { status: 400 },
    );
  }

  if (trimmedText.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      {
        error: `テキストが長すぎます。${MAX_INPUT_LENGTH}文字以内でお試しください。`,
      },
      { status: 400 },
    );
  }

  const currentDateKey = getCurrentJstDateKey();
  const cookieStore = cookies();
  const lastRun = cookieStore.get(COOKIE_NAME)?.value;

  if (lastRun === currentDateKey) {
    return NextResponse.json(
      {
        error:
          "AIチェッカーは日本時間で1日に1度まで利用できます。翌日になってから再度お試しください。",
      },
      { status: 429 },
    );
  }

  try {
    const result = await evaluateAiLikelihood(trimmedText);
    const score = clampScore(result.score);
    const label = describeAiLikelihood(score);
    const checkedAt = new Date();

    const response = NextResponse.json({
      score,
      label,
      explanation: result.explanation,
      checkedAt: checkedAt.toISOString(),
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: currentDateKey,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: getNextJstMidnight(checkedAt),
    });

    return response;
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json(
        { error: toUserFacingErrorMessage(error) },
        { status: error.status },
      );
    }

    console.error("AI checker failed", error);
    return NextResponse.json(
      { error: "AIチェッカーで予期せぬエラーが発生しました。" },
      { status: 500 },
    );
  }
}
