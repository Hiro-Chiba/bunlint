import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  HIGH_ACCURACY_COOKIE_NAME,
  HIGH_ACCURACY_DURATION_MS,
} from "@/lib/high-accuracy";
import {
  createHighAccuracyToken,
  verifyHighAccuracyToken,
} from "@/lib/high-accuracy.server";

const SUCCESS_STATUS = 200;

function clearHighAccuracyCookie(response: NextResponse) {
  response.cookies.set({
    name: HIGH_ACCURACY_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

type HighAccuracyRequestBody = {
  code?: unknown;
};

export async function GET() {
  const secret = process.env.GEMINI_HIGH_ACCURACY_CODE;
  if (!secret) {
    return NextResponse.json({ active: false }, { status: SUCCESS_STATUS });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(HIGH_ACCURACY_COOKIE_NAME);

  if (!token?.value) {
    return NextResponse.json({ active: false }, { status: SUCCESS_STATUS });
  }

  const verification = verifyHighAccuracyToken(token.value, secret);

  if (!verification) {
    const response = NextResponse.json({ active: false }, { status: SUCCESS_STATUS });
    clearHighAccuracyCookie(response);
    return response;
  }

  return NextResponse.json(
    {
      active: true,
      expiresAt: verification.expiresAt.toISOString(),
    },
    { status: SUCCESS_STATUS },
  );
}

export async function POST(request: Request) {
  const secret = process.env.GEMINI_HIGH_ACCURACY_CODE;

  if (!secret) {
    return NextResponse.json(
      { error: "現在この機能は利用できません。" },
      { status: 503 },
    );
  }

  let body: HighAccuracyRequestBody | null = null;

  try {
    body = (await request.json()) as HighAccuracyRequestBody;
  } catch {
    return NextResponse.json(
      { error: "リクエスト形式が正しくありません。" },
      { status: 400 },
    );
  }

  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json(
      { error: "特別な暗号を入力してください。" },
      { status: 400 },
    );
  }

  if (code !== secret) {
    return NextResponse.json(
      { error: "暗号が正しくありません。" },
      { status: 401 },
    );
  }

  const expiresAt = new Date(Date.now() + HIGH_ACCURACY_DURATION_MS);
  const token = createHighAccuracyToken(expiresAt, secret);

  const response = NextResponse.json(
    {
      ok: true,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 200 },
  );

  response.cookies.set({
    name: HIGH_ACCURACY_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.ceil(HIGH_ACCURACY_DURATION_MS / 1000),
    path: "/",
  });

  return response;
}
