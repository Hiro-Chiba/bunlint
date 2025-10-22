import { NextResponse } from "next/server";

import {
  GeminiError,
  analyzeAiLikelihoodWithGemini,
  toUserFacingGeminiErrorMessage,
  type AiCheckerResult,
} from "@/lib/gemini";
import { getNextJstMidnight, toJstDateString } from "@/lib/jst";

const MAX_INPUT_LENGTH = 4000;
const DAILY_LIMIT_COOKIE = "ai-check-last-jst";
const DAILY_LIMIT_MAX = 5;
const DAILY_LIMIT_MESSAGE =
  "AIチェッカーは日本時間で1日5回までご利用いただけます。";

type AiCheckUsageCookieValue = {
  date: string;
  count: number;
  lastCheckedAt: string;
};

type AiCheckRequestBody = {
  inputText?: unknown;
};

type AiCheckSuccessPayload = AiCheckerResult & {
  checkedAt: string;
  dailyCheckCount: number;
};

type AiCheckErrorPayload = {
  error: string;
  lastCheckedAt?: string;
  dailyCheckCount?: number;
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

function parseUsageCookie(
  value: string | undefined,
): AiCheckUsageCookieValue | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<AiCheckUsageCookieValue>;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid cookie");
    }

    const lastCheckedAt =
      typeof parsed.lastCheckedAt === "string" ? parsed.lastCheckedAt : null;
    const count =
      typeof parsed.count === "number" && Number.isFinite(parsed.count)
        ? Math.max(0, Math.floor(parsed.count))
        : 0;
    const dateCandidate =
      typeof parsed.date === "string" && parsed.date
        ? parsed.date
        : lastCheckedAt;

    if (!lastCheckedAt || !dateCandidate) {
      throw new Error("missing fields");
    }

    const lastCheckedDate = new Date(lastCheckedAt);
    if (Number.isNaN(lastCheckedDate.getTime())) {
      throw new Error("invalid timestamp");
    }

    const jstDate = toJstDateString(dateCandidate);
    if (!jstDate) {
      throw new Error("invalid date");
    }

    return {
      date: jstDate,
      count,
      lastCheckedAt: lastCheckedDate.toISOString(),
    };
  } catch {
    const legacyDate = new Date(trimmed);
    if (Number.isNaN(legacyDate.getTime())) {
      return null;
    }

    const jstDate = toJstDateString(legacyDate);
    if (!jstDate) {
      return null;
    }

    return {
      date: jstDate,
      count: 1,
      lastCheckedAt: legacyDate.toISOString(),
    };
  }
}

function createLimitExceededResponse(usage: AiCheckUsageCookieValue | null) {
  return NextResponse.json<AiCheckErrorPayload>(
    {
      error: DAILY_LIMIT_MESSAGE,
      lastCheckedAt: usage?.lastCheckedAt ?? undefined,
      dailyCheckCount:
        typeof usage?.count === "number"
          ? Math.min(Math.max(usage.count, 0), DAILY_LIMIT_MAX)
          : undefined,
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
  const usage = parseUsageCookie(cookies[DAILY_LIMIT_COOKIE]);

  if (usage && todayJst && usage.date === todayJst) {
    if (usage.count >= DAILY_LIMIT_MAX) {
      return createLimitExceededResponse(usage);
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
  const nextCount =
    usage && todayJst && usage.date === todayJst
      ? Math.min(usage.count + 1, DAILY_LIMIT_MAX)
      : 1;
  const response = NextResponse.json<AiCheckSuccessPayload>({
    ...result,
    checkedAt,
    dailyCheckCount: nextCount,
  });

  const usageRecord: AiCheckUsageCookieValue | null = todayJst
    ? {
        date: todayJst,
        count: nextCount,
        lastCheckedAt: checkedAt,
      }
    : null;

  response.cookies.set({
    name: DAILY_LIMIT_COOKIE,
    value: usageRecord
      ? encodeURIComponent(JSON.stringify(usageRecord))
      : checkedAt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: getNextJstMidnight(now),
  });

  return response;
}
