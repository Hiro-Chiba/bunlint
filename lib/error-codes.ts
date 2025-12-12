export type ErrorCode =
  | "AI_CHECK_PROVIDER_ERROR"
  | "AI_CHECK_UNEXPECTED_ERROR"
  | "TRANSFORM_PROVIDER_ERROR"
  | "TRANSFORM_UNEXPECTED_ERROR";

const userFacingErrorMessages: Record<ErrorCode, string> = {
  AI_CHECK_PROVIDER_ERROR: "AIチェッカーの処理中にエラーが発生しました。",
  AI_CHECK_UNEXPECTED_ERROR: "AIチェッカーの処理中にエラーが発生しました。",
  TRANSFORM_PROVIDER_ERROR: "語尾変換の処理中にエラーが発生しました。",
  TRANSFORM_UNEXPECTED_ERROR: "語尾変換の処理中にエラーが発生しました。",
};

export function createUserFacingErrorPayload(code: ErrorCode) {
  const base = userFacingErrorMessages[code] ?? "システムでエラーが発生しました。";
  return {
    error: `${base}エラーコード: ${code}。解決しない場合は管理者へお知らせください。`,
    errorCode: code,
  };
}
