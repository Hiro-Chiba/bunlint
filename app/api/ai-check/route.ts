import { NextResponse } from "next/server";

import {
  GeminiError,
  analyzeAiLikelihoodWithGemini,
  toUserFacingGeminiErrorMessage,
  type AiCheckerResult,
} from "@/lib/gemini";
import { getNextJstMidnight, isSameJstDate, toJstDateString } from "@/lib/jst";

const MAX_INPUT_LENGTH = 4000;
const DAILY_LIMIT_COOKIE = "ai-check-last-jst";
const DAILY_LIMIT_MESSAGE =
  "AIチェッカーは日本時間で1日1回までご利用いただけます。";

type AiCheckRequestBody = {
  inputText?: unknown;
};

type AiCheckSuccessPayload = AiCheckerResult & {
  checkedAt: string;
};

type AiCheckErrorPayload = {
  error: string;
  lastCheckedAt?: string;
};

function parseRequestBody(raw: Request): Promise<AiCheckRequestBody | null> {
  return raw
    .json()
    .then((value) => value as AiCheckRequestBody)
    .catch(() => null);
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return acc;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      return acc;
    }

    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function createLimitExceededResponse(lastCheckedAt: string | null) {
  return NextResponse.json<AiCheckErrorPayload>(
    {
      error: DAILY_LIMIT_MESSAGE,
      lastCheckedAt: lastCheckedAt ?? undefined,
    },
    { status: 429 },
  );
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);

  if (!body || typeof body.inputText !== "string") {
    return NextResponse.json<AiCheckErrorPayload>(
      { error: "解析するテキストが正しく送信されていません。" },
      { status: 400 },
    );
  }

  const trimmedText = body.inputText.trim();

  if (!trimmedText) {
    return NextResponse.json<AiCheckErrorPayload>(
      { error: "AIチェッカーを実行するテキストを入力してください。" },
      { status: 400 },
    );
  }

  if (trimmedText.length > MAX_INPUT_LENGTH) {
    return NextResponse.json<AiCheckErrorPayload>(
      {
        error: `テキストが長すぎます。${MAX_INPUT_LENGTH}文字以内に収めてください。`,
      },
      { status: 400 },
    );
  }

  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);

  const now = new Date();
  const todayJst = toJstDateString(now);
  const lastCheckedCookie = cookies[DAILY_LIMIT_COOKIE];
  let lastCheckedIso: string | null = null;

  if (lastCheckedCookie) {
    const lastCheckedDate = new Date(lastCheckedCookie);
    if (!Number.isNaN(lastCheckedDate.getTime())) {
      lastCheckedIso = lastCheckedDate.toISOString();
      if (todayJst && isSameJstDate(lastCheckedDate, now)) {
        return createLimitExceededResponse(lastCheckedIso);
      }
    }
  }

  let result: AiCheckerResult;

  try {
    result = await analyzeAiLikelihoodWithGemini({ text: trimmedText });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json<AiCheckErrorPayload>(
        { error: toUserFacingGeminiErrorMessage(error) },
        { status: error.status },
      );
    }

    console.error("AI checker failed", error);
    return NextResponse.json<AiCheckErrorPayload>(
      { error: "AIチェッカーの実行中に予期せぬエラーが発生しました。" },
      { status: 500 },
    );
  }

  const checkedAt = now.toISOString();
  const response = NextResponse.json<AiCheckSuccessPayload>({
    ...result,
    checkedAt,
  });

  response.cookies.set({
    name: DAILY_LIMIT_COOKIE,
    value: checkedAt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: getNextJstMidnight(now),
  });

  return response;
}
