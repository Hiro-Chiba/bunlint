"use client";

import { useEffect, useId, useMemo, useState } from "react";

import clsx from "clsx";

import {
  convertPunctuation,
  detectPunctuationMode,
  replacePunctuationCharacter,
  type PunctuationCharacter,
  type PunctuationMode,
} from "@/lib/punctuation";
import { getTextStats } from "@/lib/text";
import { writingStylePresets, type WritingStyle } from "@/lib/gemini";
import { diffWords, type DiffSegment } from "@/lib/diff";
import { clampScore } from "@/lib/jst";

import { HistoryList, type HistoryEntry } from "./HistoryList";
import { StatsPanel } from "./StatsPanel";
import { TransformationControls } from "./TransformationControls";

const USER_ID_STORAGE_KEY = "bunlint:user-id";
const HISTORY_STORAGE_KEY_PREFIX = "bunlint:history:user:";
const LEGACY_HISTORY_STORAGE_KEY = "bunlint:history";
const MAX_HISTORY_ITEMS = 10;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const generateIdentifier = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createHistoryStorageKey = (userId: string) =>
  `${HISTORY_STORAGE_KEY_PREFIX}${userId}`;

const isWritingStyle = (value: unknown): value is WritingStyle =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(writingStylePresets, value);

const resolveWritingStyleFromLabel = (label: unknown): WritingStyle | null => {
  if (typeof label !== "string" || !label) {
    return null;
  }

  for (const [value, preset] of Object.entries(writingStylePresets) as Array<
    [WritingStyle, (typeof writingStylePresets)[WritingStyle]]
  >) {
    if (preset.label === label) {
      return value;
    }
  }

  return null;
};

const normalizeHistoryEntry = (value: unknown): HistoryEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.inputText !== "string" ||
    typeof record.outputText !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return null;
  }

  if (
    record.punctuationMode !== "japanese" &&
    record.punctuationMode !== "academic" &&
    record.punctuationMode !== "western"
  ) {
    return null;
  }

  let writingStyle: WritingStyle | null = null;
  if (isWritingStyle(record.writingStyle)) {
    writingStyle = record.writingStyle;
  } else {
    writingStyle = resolveWritingStyleFromLabel(record.style);
  }

  if (!writingStyle) {
    return null;
  }

  const writingStyleLabel =
    typeof record.writingStyleLabel === "string" && record.writingStyleLabel
      ? record.writingStyleLabel
      : writingStylePresets[writingStyle]?.label;

  return {
    id: record.id,
    inputText: record.inputText,
    outputText: record.outputText,
    writingStyle,
    writingStyleLabel,
    punctuationMode: record.punctuationMode,
    createdAt: record.createdAt,
    aiUsageRate: normalizeAiUsageRate(record.aiUsageRate),
  };
};

type TransformSuccessResponse = {
  outputText: string;
  writingStyle: WritingStyle;
  punctuationMode: PunctuationMode;
  message?: string;
};

type TransformErrorResponse = {
  error: string;
};

type AiCheckerSuccessResponse = {
  score: number;
  label: string;
  explanation: string;
  checkedAt: string;
};

type AiCheckerErrorResponse = {
  error: string;
};

type AiCheckerResult = {
  score: number;
  label: string;
  explanation: string;
  checkedAt: string;
};

type AiScoreTone = "low" | "medium" | "high";

const normalizeAiUsageRate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampScore(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return clampScore(parsed);
    }
  }

  return null;
};

const resolveAiScoreTone = (score: number): AiScoreTone => {
  const normalized = clampScore(score);
  if (normalized >= 75) {
    return "high";
  }

  if (normalized >= 40) {
    return "medium";
  }

  return "low";
};

export function TextEditor() {
  const [text, setText] = useState(
    "これはサンプルテキストです。自由に編集して機能をお試しください。",
  );
  const [punctuationMode, setPunctuationMode] = useState<PunctuationMode>(() =>
    detectPunctuationMode(text),
  );
  const [writingStyle, setWritingStyle] = useState<WritingStyle>("desumasu");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserInitialized, setIsUserInitialized] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [diffSegments, setDiffSegments] = useState<DiffSegment[] | null>(null);
  const [aiCheckerResult, setAiCheckerResult] = useState<AiCheckerResult | null>(null);
  const [aiCheckerError, setAiCheckerError] = useState<string | null>(null);
  const [isAiChecking, setIsAiChecking] = useState(false);

  const editorTitleId = useId();
  const editorDescriptionId = useId();
  const statusMessageId = useId();
  const diffTitleId = useId();
  const diffDescriptionId = useId();
  const aiCheckerTitleId = useId();
  const aiCheckerDescriptionId = useId();
  const aiCheckerStatusId = useId();

  const stats = useMemo(() => getTextStats(text), [text]);

  const canRunAiCheck = text.trim().length > 0;
  const aiCheckerTone = aiCheckerResult
    ? resolveAiScoreTone(aiCheckerResult.score)
    : null;
  const aiCheckerBadgeClass = aiCheckerTone
    ? clsx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        aiCheckerTone === "low" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        aiCheckerTone === "medium" &&
          "border-amber-200 bg-amber-50 text-amber-700",
        aiCheckerTone === "high" && "border-rose-200 bg-rose-50 text-rose-700",
      )
    : undefined;
  const aiCheckerDescribedBy = aiCheckerError
    ? `${aiCheckerDescriptionId} ${aiCheckerStatusId}`
    : aiCheckerDescriptionId;

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsUserInitialized(true);
      return;
    }

    let resolvedId: string | null = null;

    try {
      const storedId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
      if (isNonEmptyString(storedId)) {
        resolvedId = storedId;
      }
    } catch (error) {
      console.error("ユーザー識別子の読み込みに失敗しました", error);
    }

    if (!resolvedId) {
      resolvedId = generateIdentifier();

      try {
        window.localStorage.setItem(USER_ID_STORAGE_KEY, resolvedId);
      } catch (error) {
        console.error("ユーザー識別子の保存に失敗しました", error);
      }
    }

    setUserId(resolvedId);
    setIsUserInitialized(true);
  }, []);

  useEffect(() => {
    if (!isUserInitialized) {
      return;
    }

    if (typeof window === "undefined") {
      setHasLoadedHistory(true);
      return;
    }

    if (!isNonEmptyString(userId)) {
      setHistoryEntries([]);
      setHasLoadedHistory(true);
      return;
    }

    const storageKey = createHistoryStorageKey(userId);

    try {
      let stored = window.localStorage.getItem(storageKey);

      if (!stored) {
        const legacyStored = window.localStorage.getItem(
          LEGACY_HISTORY_STORAGE_KEY,
        );
        if (legacyStored) {
          stored = legacyStored;
          try {
            window.localStorage.setItem(storageKey, legacyStored);
            window.localStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY);
          } catch (error) {
            console.error(
              "履歴のユーザー別領域への移行に失敗しました",
              error,
            );
          }
        }
      }

      if (!stored) {
        setHistoryEntries([]);
        return;
      }

      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        window.localStorage.removeItem(storageKey);
        setHistoryEntries([]);
        return;
      }

      const normalized = parsed
        .map((entry) => normalizeHistoryEntry(entry))
        .filter((entry): entry is HistoryEntry => entry !== null)
        .slice(0, MAX_HISTORY_ITEMS);

      if (normalized.length > 0) {
        setHistoryEntries(normalized);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error("履歴の読み込みに失敗しました", error);
    } finally {
      setHasLoadedHistory(true);
    }
  }, [isUserInitialized, userId]);

  useEffect(() => {
    if (
      !hasLoadedHistory ||
      typeof window === "undefined" ||
      !isNonEmptyString(userId)
    ) {
      return;
    }

    try {
      window.localStorage.setItem(
        createHistoryStorageKey(userId),
        JSON.stringify(historyEntries),
      );
    } catch (error) {
      console.error("履歴の保存に失敗しました", error);
    }
  }, [historyEntries, hasLoadedHistory, userId]);

  const handleTextChange = (value: string) => {
    setText(value);
    setPunctuationMode(detectPunctuationMode(value));
    setStatusMessage(null);
    setDiffSegments(null);
    setAiCheckerResult(null);
    setAiCheckerError(null);
  };

  const handlePunctuationModeChange = (mode: PunctuationMode) => {
    if (mode === punctuationMode) {
      return;
    }

    const converted = convertPunctuation(text, mode);
    setText(converted);
    setPunctuationMode(mode);
    setDiffSegments(null);
    setAiCheckerResult(null);
    setAiCheckerError(null);
    const statusMessages: Record<PunctuationMode, string> = {
      academic: "句読点を学術スタイル（，．）に変換しました。",
      japanese: "句読点を和文スタイル（、。）に変換しました。",
      western: "句読点を欧文スタイル（,.）に変換しました。",
    };

    setStatusMessage(statusMessages[mode]);
  };

  const handlePunctuationCharacterReplace = (
    from: PunctuationCharacter,
    to: PunctuationCharacter,
  ) => {
    if (from === to) {
      setStatusMessage(`「${from}」は既に同じ記号が選択されています。`);
      return;
    }

    if (!text.includes(from)) {
      setStatusMessage(`「${from}」に該当する記号が見つからなかったため、変更はありません。`);
      return;
    }

    const converted = replacePunctuationCharacter(text, from, to);
    if (converted === text) {
      setStatusMessage("記号の変換結果に変更はありませんでした。");
      return;
    }

    setText(converted);
    setPunctuationMode(detectPunctuationMode(converted));
    setDiffSegments(null);
    setAiCheckerResult(null);
    setAiCheckerError(null);
    setStatusMessage(`「${from}」を「${to}」に変換しました。`);
  };

  const handleInvokeStyleTransform = async () => {
    if (isTransforming) {
      return;
    }

    if (!text.trim()) {
      setStatusMessage("語尾変換を行うテキストを入力してください。");
      return;
    }

    const previousText = text;
    setIsTransforming(true);
    setStatusMessage("AI変換を実行しています...");
    setAiCheckerResult(null);
    setAiCheckerError(null);

    try {
      const response = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: text,
          writingStyle,
          punctuationMode,
        }),
      });

      let payload: TransformSuccessResponse | TransformErrorResponse | null =
        null;

      try {
        payload = (await response.json()) as
          | TransformSuccessResponse
          | TransformErrorResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          payload && "error" in payload && payload.error
            ? payload.error
            : "語尾変換に失敗しました。時間をおいて再度お試しください。";
        setStatusMessage(errorMessage);
        return;
      }

      if (!payload || !("outputText" in payload)) {
        setStatusMessage("AI変換の結果を取得できませんでした。");
        return;
      }

      const result = payload;
      setText(result.outputText);
      setPunctuationMode(result.punctuationMode);

      const segments = diffWords(previousText, result.outputText);
      const hasMeaningfulDiff = segments.some(
        (segment) => segment.type !== "unchanged",
      );
      setDiffSegments(hasMeaningfulDiff ? segments : null);

      const preset =
        writingStylePresets[result.writingStyle] ??
        writingStylePresets[writingStyle];
      const writingStyleLabel = preset?.label ?? result.writingStyle;
      const successMessage =
        result.message && result.message.trim()
          ? result.message
          : `AI変換で${writingStyleLabel}に整形しました。`;
      setStatusMessage(successMessage);

      const entry: HistoryEntry = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        inputText: previousText,
        outputText: result.outputText,
        writingStyle: result.writingStyle,
        writingStyleLabel,
        punctuationMode: result.punctuationMode,
        createdAt: new Date().toISOString(),
        aiUsageRate: null,
      };

      setHistoryEntries((current) => {
        const next = [entry, ...current];
        return next.slice(0, MAX_HISTORY_ITEMS);
      });
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "ネットワークエラーが発生しました。通信環境をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setIsTransforming(false);
    }
  };

  const updateHistoryWithAiScore = (score: number) => {
    setHistoryEntries((current) => {
      if (current.length === 0) {
        return current;
      }

      const normalizedScore = clampScore(score);
      let updated = false;
      const next = current.map((entry) => {
        if (!updated && entry.outputText === text) {
          updated = true;
          return { ...entry, aiUsageRate: normalizedScore };
        }
        return entry;
      });

      if (updated) {
        return next;
      }

      const [first, ...rest] = next;
      if (!first) {
        return next;
      }

      return [{ ...first, aiUsageRate: normalizedScore }, ...rest];
    });
  };

  const handleInvokeAiCheck = async () => {
    if (isAiChecking) {
      return;
    }

    if (!text.trim()) {
      setAiCheckerError("AIチェッカーを実行するテキストを入力してください。");
      return;
    }

    setIsAiChecking(true);
    setAiCheckerError(null);

    try {
      const response = await fetch("/api/ai-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: text,
        }),
      });

      let payload: AiCheckerSuccessResponse | AiCheckerErrorResponse | null = null;

      try {
        payload = (await response.json()) as
          | AiCheckerSuccessResponse
          | AiCheckerErrorResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AIチェッカーの実行に失敗しました。時間をおいて再度お試しください。";
        setAiCheckerError(errorMessage);
        return;
      }

      if (!payload || !("score" in payload)) {
        setAiCheckerError("AIチェッカーの結果を取得できませんでした。");
        return;
      }

      const sanitizedScore = clampScore(payload.score);
      const explanation =
        typeof payload.explanation === "string" && payload.explanation.trim().length > 0
          ? payload.explanation.trim()
          : "AIチェッカーの説明を取得できませんでした。";
      const label =
        typeof payload.label === "string" && payload.label.trim().length > 0
          ? payload.label.trim()
          : "AIチェッカー結果";
      const checkedAt =
        typeof payload.checkedAt === "string" && payload.checkedAt
          ? payload.checkedAt
          : new Date().toISOString();

      const result: AiCheckerResult = {
        score: sanitizedScore,
        label,
        explanation,
        checkedAt,
      };

      setAiCheckerResult(result);
      setStatusMessage(null);
      updateHistoryWithAiScore(sanitizedScore);
    } catch (error) {
      console.error("AI checker request failed", error);
      setAiCheckerError(
        "AIチェッカーの実行中に通信エラーが発生しました。しばらく時間をおいて再度お試しください。",
      );
    } finally {
      setIsAiChecking(false);
    }
  };

  const textareaDescribedBy = statusMessage
    ? `${editorDescriptionId} ${statusMessageId}`
    : editorDescriptionId;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <header className="space-y-1">
            <h2
              id={editorTitleId}
              className="text-lg font-semibold text-slate-800"
            >
              テキストエディタ
            </h2>
            <p id={editorDescriptionId} className="text-sm text-slate-500">
              テキストを入力すると、文字数や文数がリアルタイムに更新されます。
            </p>
          </header>
          <textarea
            className="min-h-[16rem] w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder="ここに文章を入力してください"
            aria-labelledby={editorTitleId}
            aria-describedby={textareaDescribedBy}
          />
          {statusMessage && (
            <div
              role="status"
              id={statusMessageId}
              className="rounded-md border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700"
            >
              {statusMessage}
            </div>
          )}
          {diffSegments && (
            <section
              className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
              aria-labelledby={diffTitleId}
              aria-describedby={diffDescriptionId}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <h3 id={diffTitleId} className="font-semibold text-slate-700">
                  AI差分プレビュー
                </h3>
                <span>追加: 緑 / 削除: 赤</span>
              </div>
              <p id={diffDescriptionId} className="text-xs text-slate-500">
                AI変換による変更箇所を背景色でハイライト表示しています。
              </p>
              <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                {diffSegments.map((segment, index) => {
                  const isWhitespaceOnly = segment.value.trim().length === 0;
                  return (
                    <span
                      key={`diff-${index}`}
                      className={clsx(
                        segment.type === "added" && !isWhitespaceOnly
                          ? "rounded-sm bg-emerald-100 px-1 text-emerald-900"
                          : undefined,
                        segment.type === "removed" && !isWhitespaceOnly
                          ? "rounded-sm bg-rose-100 px-1 text-rose-900 line-through"
                          : segment.type === "removed"
                            ? "line-through text-rose-600"
                            : undefined,
                      )}
                    >
                      {segment.value}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
          <StatsPanel stats={stats} />
          <section
            className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            aria-labelledby={aiCheckerTitleId}
            aria-describedby={aiCheckerDescriptionId}
          >
            <header className="space-y-1">
              <h3
                id={aiCheckerTitleId}
                className="text-sm font-semibold text-slate-700"
              >
                AIチェッカー
              </h3>
              <p id={aiCheckerDescriptionId} className="text-xs text-slate-500">
                現在のテキストがAI生成らしいかを診断します。日本時間で1日に1度だけ実行できます。
              </p>
            </header>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 shadow-sm transition-colors hover:bg-brand-50 disabled:border-slate-300 disabled:text-slate-400"
                onClick={handleInvokeAiCheck}
                disabled={isAiChecking || !canRunAiCheck}
                aria-describedby={aiCheckerDescribedBy}
                aria-busy={isAiChecking || undefined}
              >
                {isAiChecking ? "診断中..." : "AIらしさを診断"}
              </button>
              {aiCheckerResult && aiCheckerBadgeClass && (
                <span className={aiCheckerBadgeClass}>
                  AI利用率 {aiCheckerResult.score}%
                </span>
              )}
            </div>
            {aiCheckerError && (
              <p
                id={aiCheckerStatusId}
                role="status"
                className="text-sm text-rose-600"
              >
                {aiCheckerError}
              </p>
            )}
            {aiCheckerResult && (
              <div className="space-y-2 text-sm text-slate-600">
                <p className="font-semibold text-slate-700">
                  {aiCheckerResult.label}
                </p>
                <p>{aiCheckerResult.explanation}</p>
                <p className="text-xs text-slate-400">
                  診断日時：
                  {new Date(aiCheckerResult.checkedAt).toLocaleString("ja-JP")}
                </p>
              </div>
            )}
          </section>
        </section>
        <TransformationControls
          punctuationMode={punctuationMode}
          onPunctuationModeChange={handlePunctuationModeChange}
          onPunctuationCharacterReplace={handlePunctuationCharacterReplace}
          writingStyle={writingStyle}
          onWritingStyleChange={setWritingStyle}
          onInvokeStyleTransform={handleInvokeStyleTransform}
          isTransforming={isTransforming}
        />
      </div>
      <HistoryList entries={historyEntries} isLoading={!hasLoadedHistory} />
    </div>
  );
}
