"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  convertPunctuation,
  detectPunctuationMode,
  replacePunctuationCharacter,
  type PunctuationCharacter,
  type PunctuationMode,
} from "@/lib/punctuation";
import {
  writingStylePresets,
  normalizeWritingStyle,
  resolveWritingStyleFromLabel,
  type AiConfidenceLevel,
  type WritingStyle,
} from "@/lib/gemini";
import { HISTORY_RETENTION_MS } from "@/lib/history/constants";
import { diffWords, type DiffSegment } from "@/lib/diff";
import { getNextJstMidnight, isSameJstDate } from "@/lib/jst";
import { resolveNextDailyCount } from "@/lib/ai-limit";

import {
  HistoryList,
  type HistoryEntry,
  type HistoryRestoreMode,
} from "./HistoryList";
import { TransformationControls } from "./TransformationControls";
import { DEFAULT_AI_REASONING } from "./text-editor/constants";
import type { AiCheckResultState } from "./text-editor/types";
import { EditorTextareaSection } from "./text-editor/EditorTextareaSection";
import { AiCheckerSection } from "./text-editor/AiCheckerSection";
import { LatestHistoryCard } from "./text-editor/LatestHistoryCard";
import { HighAccuracyModal } from "./text-editor/HighAccuracyModal";

const USER_ID_STORAGE_KEY = "bunlint:user-id";
const HISTORY_STORAGE_KEY_PREFIX = "bunlint:history:user:";
const LEGACY_HISTORY_STORAGE_KEY = "bunlint:history";
const MAX_HISTORY_ITEMS = 10;
const AI_CHECK_STORAGE_KEY_PREFIX = "bunlint:ai-check:user:";
const DAILY_AI_CHECK_LIMIT = 5;
const HIGH_ACCURACY_STORAGE_KEY = "bunlint:high-accuracy";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const generateIdentifier = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createHistoryStorageKey = (userId: string) =>
  `${HISTORY_STORAGE_KEY_PREFIX}${userId}`;

const createAiCheckStorageKey = (userId: string) =>
  `${AI_CHECK_STORAGE_KEY_PREFIX}${userId}`;

const isAiConfidenceLevel = (value: unknown): value is AiConfidenceLevel =>
  value === "low" || value === "medium" || value === "high";

const inferConfidenceFromScore = (score: number): AiConfidenceLevel => {
  if (score >= 66) {
    return "high";
  }

  if (score >= 34) {
    return "medium";
  }

  return "low";
};

const pruneExpiredHistoryEntries = (
  entries: HistoryEntry[],
): HistoryEntry[] => {
  const now = Date.now();

  return entries.filter((entry) => {
    const createdAt = new Date(entry.createdAt).getTime();
    if (!Number.isFinite(createdAt)) {
      return false;
    }

    return now - createdAt < HISTORY_RETENTION_MS;
  });
};

type StoredAiCheckSnapshot = {
  score: number;
  confidence: AiConfidenceLevel;
  reasoning?: string;
  checkedAt: string;
  textSnapshot?: string;
  dailyCount?: number;
  lastCheckedAt?: string;
};

type StoredHighAccuracyState = {
  expiresAt: string;
};

type HighAccuracyStatusResponse = {
  active?: boolean;
  expiresAt?: string;
  error?: string;
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

  let writingStyle = normalizeWritingStyle(record.writingStyle);

  if (!writingStyle) {
    writingStyle = resolveWritingStyleFromLabel(record.style);
  }

  if (!writingStyle) {
    writingStyle = resolveWritingStyleFromLabel(record.writingStyleLabel);
  }

  if (!writingStyle) {
    return null;
  }

  const writingStyleLabel =
    writingStylePresets[writingStyle]?.label ??
    (typeof record.writingStyleLabel === "string"
      ? record.writingStyleLabel
      : undefined);

  let aiScore: number | undefined;
  if (typeof record.aiScore === "number" && Number.isFinite(record.aiScore)) {
    aiScore = record.aiScore;
  } else if (typeof record.aiScore === "string") {
    const parsed = Number.parseFloat(record.aiScore);
    if (Number.isFinite(parsed)) {
      aiScore = parsed;
    }
  }

  const normalized: HistoryEntry = {
    id: record.id,
    inputText: record.inputText,
    outputText: record.outputText,
    writingStyle,
    writingStyleLabel,
    punctuationMode: record.punctuationMode,
    createdAt: record.createdAt,
  };

  if (typeof aiScore === "number") {
    normalized.aiScore = aiScore;
  }

  if (isAiConfidenceLevel(record.aiConfidence)) {
    normalized.aiConfidence = record.aiConfidence;
  }

  if (typeof record.aiReasoning === "string" && record.aiReasoning) {
    normalized.aiReasoning = record.aiReasoning;
  }

  if (typeof record.aiCheckedAt === "string") {
    normalized.aiCheckedAt = record.aiCheckedAt;
  }

  return normalized;
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

type AiCheckSuccessResponse = {
  score?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
  checkedAt?: unknown;
  dailyCheckCount?: unknown;
};

type AiCheckErrorResponse = {
  error?: unknown;
  lastCheckedAt?: unknown;
  dailyCheckCount?: unknown;
};

const isAiCheckSuccessPayload = (
  payload: AiCheckSuccessResponse | AiCheckErrorResponse | null,
): payload is AiCheckSuccessResponse & { score: number; checkedAt: string } =>
  !!payload &&
  typeof (payload as AiCheckSuccessResponse).score === "number" &&
  typeof (payload as AiCheckSuccessResponse).checkedAt === "string";

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
  const [activeHistoryEntryId, setActiveHistoryEntryId] = useState<
    string | null
  >(null);
  const [aiCheckResult, setAiCheckResult] = useState<AiCheckResultState | null>(
    null,
  );
  const [aiCheckMessage, setAiCheckMessage] = useState<string | null>(null);
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const [lastAiCheckAt, setLastAiCheckAt] = useState<string | null>(null);
  const [aiChecksToday, setAiChecksToday] = useState(0);
  const [isHighAccuracyModalOpen, setIsHighAccuracyModalOpen] =
    useState(false);
  const [highAccuracyCode, setHighAccuracyCode] = useState("");
  const [highAccuracyError, setHighAccuracyError] =
    useState<string | null>(null);
  const [isActivatingHighAccuracy, setIsActivatingHighAccuracy] =
    useState(false);
  const [highAccuracyExpiresAt, setHighAccuracyExpiresAt] =
    useState<string | null>(null);
  const [highAccuracyNow, setHighAccuracyNow] = useState(() => Date.now());

  const highAccuracyExpiryTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const editorTitleId = useId();
  const editorDescriptionId = useId();
  const statusMessageId = useId();
  const diffTitleId = useId();
  const diffDescriptionId = useId();

  const refreshHighAccuracyStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/high-accuracy", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as HighAccuracyStatusResponse;

      if (!isMountedRef.current) {
        return;
      }

      if (payload && payload.active && typeof payload.expiresAt === "string") {
        setHighAccuracyExpiresAt(payload.expiresAt);
        setHighAccuracyNow(Date.now());
      } else if (!payload?.active) {
        setHighAccuracyExpiresAt(null);
      }
    } catch (error) {
      console.error("高精度モードの状態取得に失敗しました", error);
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      if (typeof window !== "undefined" && highAccuracyExpiryTimeoutRef.current) {
        window.clearTimeout(highAccuracyExpiryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(HIGH_ACCURACY_STORAGE_KEY);

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Partial<StoredHighAccuracyState>;

      if (parsed && typeof parsed.expiresAt === "string") {
        const expiresAt = new Date(parsed.expiresAt);

        if (!Number.isFinite(expiresAt.getTime())) {
          window.localStorage.removeItem(HIGH_ACCURACY_STORAGE_KEY);
          return;
        }

        if (expiresAt.getTime() > Date.now()) {
          setHighAccuracyExpiresAt(parsed.expiresAt);
          setHighAccuracyNow(Date.now());
        } else {
          window.localStorage.removeItem(HIGH_ACCURACY_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("高精度モードの状態読み込みに失敗しました", error);
    }
  }, []);

  useEffect(() => {
    refreshHighAccuracyStatus();
  }, [refreshHighAccuracyStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (typeof highAccuracyExpiresAt === "string" && highAccuracyExpiresAt) {
      try {
        const payload: StoredHighAccuracyState = {
          expiresAt: highAccuracyExpiresAt,
        };
        window.localStorage.setItem(
          HIGH_ACCURACY_STORAGE_KEY,
          JSON.stringify(payload),
        );
      } catch (error) {
        console.error("高精度モードの状態保存に失敗しました", error);
      }
      return;
    }

    try {
      window.localStorage.removeItem(HIGH_ACCURACY_STORAGE_KEY);
    } catch (error) {
      console.error("高精度モードの状態削除に失敗しました", error);
    }
  }, [highAccuracyExpiresAt]);

  useEffect(() => {
    if (typeof window === "undefined" || !highAccuracyExpiresAt) {
      return;
    }

    setHighAccuracyNow(Date.now());

    const intervalId = window.setInterval(() => {
      setHighAccuracyNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [highAccuracyExpiresAt]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (highAccuracyExpiryTimeoutRef.current) {
      window.clearTimeout(highAccuracyExpiryTimeoutRef.current);
      highAccuracyExpiryTimeoutRef.current = null;
    }

    if (!highAccuracyExpiresAt) {
      return;
    }

    const expiresAt = new Date(highAccuracyExpiresAt);

    if (!Number.isFinite(expiresAt.getTime())) {
      setHighAccuracyExpiresAt(null);
      return;
    }

    const remainingMs = expiresAt.getTime() - Date.now();

    if (remainingMs <= 0) {
      setHighAccuracyExpiresAt(null);
      return;
    }

    highAccuracyExpiryTimeoutRef.current = window.setTimeout(() => {
      highAccuracyExpiryTimeoutRef.current = null;
      setHighAccuracyExpiresAt(null);
      setStatusMessage("高精度モードの有効期限が切れました。");
    }, remainingMs);

    return () => {
      if (highAccuracyExpiryTimeoutRef.current) {
        window.clearTimeout(highAccuracyExpiryTimeoutRef.current);
        highAccuracyExpiryTimeoutRef.current = null;
      }
    };
  }, [highAccuracyExpiresAt, setStatusMessage]);

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
      setActiveHistoryEntryId(null);
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
            console.error("履歴のユーザー別領域への移行に失敗しました", error);
          }
        }
      }

      if (!stored) {
        setHistoryEntries([]);
        setActiveHistoryEntryId(null);
        return;
      }

      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        window.localStorage.removeItem(storageKey);
        setHistoryEntries([]);
        setActiveHistoryEntryId(null);
        return;
      }

      const normalized = parsed
        .map((entry) => normalizeHistoryEntry(entry))
        .filter((entry): entry is HistoryEntry => entry !== null)
        .slice(0, MAX_HISTORY_ITEMS);

      const pruned = pruneExpiredHistoryEntries(normalized);

      if (pruned.length > 0) {
        setHistoryEntries(pruned);
      } else {
        window.localStorage.removeItem(storageKey);
        setHistoryEntries([]);
        setActiveHistoryEntryId(null);
      }
    } catch (error) {
      console.error("履歴の読み込みに失敗しました", error);
      setActiveHistoryEntryId(null);
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

  useEffect(() => {
    if (!isUserInitialized || typeof window === "undefined") {
      return;
    }

    if (!isNonEmptyString(userId)) {
      setLastAiCheckAt(null);
      if (aiCheckResult) {
        setAiCheckResult(null);
      }
      if (aiChecksToday !== 0) {
        setAiChecksToday(0);
      }
      return;
    }

    try {
      const stored = window.localStorage.getItem(
        createAiCheckStorageKey(userId),
      );

      if (!stored) {
        setLastAiCheckAt(null);
        if (aiChecksToday !== 0) {
          setAiChecksToday(0);
        }
        return;
      }

      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") {
        setLastAiCheckAt(null);
        if (aiChecksToday !== 0) {
          setAiChecksToday(0);
        }
        return;
      }

      const snapshot = parsed as Partial<StoredAiCheckSnapshot>;

      const resolvedLastCheckedAt =
        (typeof snapshot.checkedAt === "string" && snapshot.checkedAt) ||
        (typeof snapshot.lastCheckedAt === "string"
          ? snapshot.lastCheckedAt
          : null);

      if (resolvedLastCheckedAt) {
        setLastAiCheckAt(resolvedLastCheckedAt);
      } else {
        setLastAiCheckAt(null);
      }

      let restoredCount = false;

      if (
        typeof snapshot.dailyCount === "number" &&
        Number.isFinite(snapshot.dailyCount) &&
        resolvedLastCheckedAt &&
        isSameJstDate(resolvedLastCheckedAt, new Date())
      ) {
        const normalizedCount = Math.min(
          DAILY_AI_CHECK_LIMIT,
          Math.max(0, Math.floor(snapshot.dailyCount)),
        );
        setAiChecksToday(normalizedCount);
        restoredCount = true;
      }

      if (!restoredCount && aiChecksToday !== 0) {
        setAiChecksToday(0);
      }

      if (
        typeof snapshot.score === "number" &&
        isAiConfidenceLevel(snapshot.confidence) &&
        resolvedLastCheckedAt &&
        typeof snapshot.textSnapshot === "string" &&
        snapshot.textSnapshot === text
      ) {
        setAiCheckResult({
          score: snapshot.score,
          confidence: snapshot.confidence,
          reasoning:
            typeof snapshot.reasoning === "string" && snapshot.reasoning
              ? snapshot.reasoning
              : DEFAULT_AI_REASONING[snapshot.confidence],
          checkedAt: resolvedLastCheckedAt,
          textSnapshot: snapshot.textSnapshot,
        });
      }
    } catch (error) {
      console.error("AIチェッカーの履歴読み込みに失敗しました", error);
    }
  }, [aiCheckResult, aiChecksToday, isUserInitialized, text, userId]);

  useEffect(() => {
    if (!lastAiCheckAt) {
      if (aiChecksToday !== 0) {
        setAiChecksToday(0);
      }
      return;
    }

    if (!isSameJstDate(lastAiCheckAt, new Date()) && aiChecksToday !== 0) {
      setAiChecksToday(0);
    }
  }, [aiChecksToday, lastAiCheckAt]);

  const handleTextChange = (value: string) => {
    setText(value);
    setPunctuationMode(detectPunctuationMode(value));
    setStatusMessage(null);
    setDiffSegments(null);
    setActiveHistoryEntryId(null);
    setAiCheckResult(null);
    setAiCheckMessage(null);
  };

  const handleClearText = () => {
    if (text.length === 0) {
      return;
    }

    handleTextChange("");
  };

  const handlePunctuationModeChange = (mode: PunctuationMode) => {
    if (mode === punctuationMode) {
      return;
    }

    const converted = convertPunctuation(text, mode);
    setText(converted);
    setPunctuationMode(mode);
    setDiffSegments(null);
    setActiveHistoryEntryId(null);
    setAiCheckResult(null);
    setAiCheckMessage(null);
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
      setStatusMessage(
        `「${from}」に該当する記号が見つからなかったため、変更はありません。`,
      );
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
    setActiveHistoryEntryId(null);
    setAiCheckResult(null);
    setAiCheckMessage(null);
    setStatusMessage(`「${from}」を「${to}」に変換しました。`);
  };

  const handleOpenHighAccuracyModal = useCallback(() => {
    setHighAccuracyCode("");
    setHighAccuracyError(null);
    setIsHighAccuracyModalOpen(true);
  }, []);

  const handleCloseHighAccuracyModal = useCallback(() => {
    if (!isActivatingHighAccuracy) {
      setIsHighAccuracyModalOpen(false);
      setHighAccuracyCode("");
      setHighAccuracyError(null);
    }
  }, [isActivatingHighAccuracy]);

  const handleHighAccuracyCodeChange = useCallback(
    (value: string) => {
      setHighAccuracyCode(value);
      if (highAccuracyError) {
        setHighAccuracyError(null);
      }
    },
    [highAccuracyError],
  );

  const handleActivateHighAccuracy = useCallback(async () => {
    if (isActivatingHighAccuracy) {
      return;
    }

    const trimmed = highAccuracyCode.trim();
    if (!trimmed) {
      setHighAccuracyError("暗号を入力してください。");
      return;
    }

    setIsActivatingHighAccuracy(true);
    setHighAccuracyError(null);

    try {
      const response = await fetch("/api/high-accuracy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      let payload: HighAccuracyStatusResponse | { expiresAt?: unknown; error?: unknown } | null = null;

      try {
        payload = (await response.json()) as
          | HighAccuracyStatusResponse
          | { expiresAt?: unknown; error?: unknown };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          payload && typeof (payload as any)?.error === "string"
            ? String((payload as any).error)
            : "暗号の確認に失敗しました。時間をおいて再試行してください。";
        setHighAccuracyError(errorMessage);
        return;
      }

      const expiresAt =
        payload && typeof payload.expiresAt === "string"
          ? payload.expiresAt
          : null;

      if (!expiresAt) {
        setHighAccuracyError(
          "高精度モードの有効化に失敗しました。管理者にお問い合わせください。",
        );
        return;
      }

      setHighAccuracyExpiresAt(expiresAt);
      setHighAccuracyNow(Date.now());
      setHighAccuracyCode("");
      setHighAccuracyError(null);
      setIsHighAccuracyModalOpen(false);
      setStatusMessage("高精度モードを10分間有効化しました。");
    } catch (error) {
      console.error("高精度モードの有効化に失敗しました", error);
      setHighAccuracyError(
        "高精度モードの有効化に失敗しました。通信環境をご確認のうえ再度お試しください。",
      );
    } finally {
      setIsActivatingHighAccuracy(false);
    }
  }, [highAccuracyCode, isActivatingHighAccuracy]);

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
    setAiCheckResult(null);
    setAiCheckMessage(null);

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
      };

      setHistoryEntries((current) => {
        const pruned = pruneExpiredHistoryEntries([entry, ...current]);
        return pruned.slice(0, MAX_HISTORY_ITEMS);
      });
      setActiveHistoryEntryId(entry.id);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "ネットワークエラーが発生しました。通信環境をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setIsTransforming(false);
    }
  };

  const handleInvokeAiCheck = async () => {
    if (isCheckingAi) {
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setAiCheckMessage("AIチェッカーを実行するテキストを入力してください。");
      return;
    }

    const now = new Date();
    const hasReachedLimitToday =
      lastAiCheckAt &&
      isSameJstDate(lastAiCheckAt, now) &&
      aiChecksToday >= DAILY_AI_CHECK_LIMIT;

    if (hasReachedLimitToday) {
      const nextWindow = getNextJstMidnight(new Date(lastAiCheckAt));
      const nextLabel = nextWindow.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      });
      setAiCheckMessage(
        `AIチェッカーは日本時間で1日5回までです。次回は${nextLabel}以降にお試しください。`,
      );
      return;
    }

    setIsCheckingAi(true);
    setAiCheckMessage("AIチェッカーを実行しています...");

    try {
      const response = await fetch("/api/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: text }),
      });

      let payload: AiCheckSuccessResponse | AiCheckErrorResponse | null = null;
      try {
        payload = (await response.json()) as
          | AiCheckSuccessResponse
          | AiCheckErrorResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorPayload = payload as AiCheckErrorResponse | null;
        const errorMessage =
          errorPayload && typeof errorPayload.error === "string"
            ? errorPayload.error
            : "AIチェッカーの実行に失敗しました。時間をおいて再度お試しください。";

        let normalizedCount: number | null = null;

        if (errorPayload && typeof errorPayload.lastCheckedAt === "string") {
          setLastAiCheckAt(errorPayload.lastCheckedAt);
        }

        if (
          errorPayload &&
          typeof errorPayload.dailyCheckCount === "number" &&
          Number.isFinite(errorPayload.dailyCheckCount)
        ) {
          normalizedCount = Math.min(
            DAILY_AI_CHECK_LIMIT,
            Math.max(0, Math.floor(errorPayload.dailyCheckCount)),
          );
          setAiChecksToday(normalizedCount);
        }

        if (typeof window !== "undefined" && isNonEmptyString(userId)) {
          try {
            const storageKey = createAiCheckStorageKey(userId);
            let existing: Partial<StoredAiCheckSnapshot> = {};

            const stored = window.localStorage.getItem(storageKey);
            if (stored) {
              try {
                const parsed: unknown = JSON.parse(stored);
                if (parsed && typeof parsed === "object") {
                  existing = parsed as Partial<StoredAiCheckSnapshot>;
                }
              } catch {
                existing = {};
              }
            }

            const nextSnapshot: Partial<StoredAiCheckSnapshot> = {
              ...existing,
            };

            if (
              errorPayload &&
              typeof errorPayload.lastCheckedAt === "string"
            ) {
              nextSnapshot.lastCheckedAt = errorPayload.lastCheckedAt;
              nextSnapshot.checkedAt = errorPayload.lastCheckedAt;
            }

            if (normalizedCount !== null) {
              nextSnapshot.dailyCount = normalizedCount;
            }

            window.localStorage.setItem(
              storageKey,
              JSON.stringify(nextSnapshot),
            );
          } catch (storageError) {
            console.error("AIチェッカー結果の保存に失敗しました", storageError);
          }
        }

        setAiCheckMessage(errorMessage);
        return;
      }

      if (!isAiCheckSuccessPayload(payload)) {
        setAiCheckMessage("AIチェッカーの結果を取得できませんでした。");
        return;
      }

      const successPayload = payload;

      const score = Math.round(
        Math.max(0, Math.min(100, successPayload.score)),
      );
      const confidence = isAiConfidenceLevel(successPayload.confidence)
        ? successPayload.confidence
        : inferConfidenceFromScore(score);
      const reasoning =
        typeof successPayload.reasoning === "string" &&
        successPayload.reasoning.trim().length > 0
          ? successPayload.reasoning.trim()
          : DEFAULT_AI_REASONING[confidence];
      const checkedAt: string = successPayload.checkedAt;
      const nextDailyCount = resolveNextDailyCount({
        reportedDailyCount: successPayload.dailyCheckCount,
        previousCount: aiChecksToday,
        lastCheckedAt: lastAiCheckAt,
        currentCheckedAt: checkedAt,
        dailyLimit: DAILY_AI_CHECK_LIMIT,
      });

      const result: AiCheckResultState = {
        score,
        confidence,
        reasoning,
        checkedAt,
        textSnapshot: text,
      };

      setAiCheckResult(result);
      setAiChecksToday(nextDailyCount);
      setAiCheckMessage(`AI生成らしさを判定しました（${score}%）。`);
      setLastAiCheckAt(checkedAt);

      if (typeof window !== "undefined" && isNonEmptyString(userId)) {
        const snapshot: StoredAiCheckSnapshot = {
          score: result.score,
          confidence: result.confidence,
          reasoning: result.reasoning,
          checkedAt: result.checkedAt,
          lastCheckedAt: result.checkedAt,
          textSnapshot: result.textSnapshot,
          dailyCount: nextDailyCount,
        };

        try {
          window.localStorage.setItem(
            createAiCheckStorageKey(userId),
            JSON.stringify(snapshot),
          );
        } catch (error) {
          console.error("AIチェッカー結果の保存に失敗しました", error);
        }
      }

      let matchedEntryId: string | null = null;

      setHistoryEntries((current) => {
        const updateEntries = (
          entries: HistoryEntry[],
          predicate: (entry: HistoryEntry) => boolean,
        ) => {
          let updated = false;
          const nextEntries = entries.map((entry) => {
            if (!updated && predicate(entry)) {
              updated = true;
              matchedEntryId = entry.id;
              return {
                ...entry,
                aiScore: result.score,
                aiConfidence: result.confidence,
                aiReasoning: result.reasoning,
                aiCheckedAt: result.checkedAt,
              };
            }
            return entry;
          });

          return { updated, entries: nextEntries };
        };

        const byOutput = updateEntries(
          current,
          (entry) => entry.outputText === text,
        );
        if (byOutput.updated) {
          return byOutput.entries;
        }

        const byInput = updateEntries(
          current,
          (entry) => entry.inputText === text,
        );
        if (byInput.updated) {
          return byInput.entries;
        }

        return current;
      });

      if (matchedEntryId) {
        setActiveHistoryEntryId(matchedEntryId);
      }
    } catch (error) {
      console.error("AI checker request failed", error);
      setAiCheckMessage(
        "AIチェッカーの呼び出しに失敗しました。通信環境をご確認のうえ、再度お試しください。",
      );
    } finally {
      setIsCheckingAi(false);
    }
  };

  const aiResultForCurrentText =
    aiCheckResult && aiCheckResult.textSnapshot === text ? aiCheckResult : null;

  const hasCheckedOnSameDay =
    typeof lastAiCheckAt === "string" && lastAiCheckAt
      ? isSameJstDate(lastAiCheckAt, new Date())
      : false;

  const hasReachedDailyLimit =
    hasCheckedOnSameDay && aiChecksToday >= DAILY_AI_CHECK_LIMIT;

  const remainingAiChecks = hasCheckedOnSameDay
    ? Math.max(0, DAILY_AI_CHECK_LIMIT - aiChecksToday)
    : DAILY_AI_CHECK_LIMIT;

  const nextAiCheckWindow =
    hasReachedDailyLimit && lastAiCheckAt
      ? getNextJstMidnight(new Date(lastAiCheckAt))
      : null;

  const nextAiCheckLabel = nextAiCheckWindow
    ? nextAiCheckWindow.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : null;

  const highAccuracyStatusLabel = useMemo(() => {
    if (!highAccuracyExpiresAt) {
      return null;
    }

    const expiresAt = new Date(highAccuracyExpiresAt);
    if (!Number.isFinite(expiresAt.getTime())) {
      return null;
    }

    const remainingMs = expiresAt.getTime() - highAccuracyNow;
    if (remainingMs <= 0) {
      return null;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `高精度モード有効中（残り${minutes}分${seconds
      .toString()
      .padStart(2, "0")}秒）`;
  }, [highAccuracyExpiresAt, highAccuracyNow]);

  const isHighAccuracyActive = Boolean(highAccuracyStatusLabel);

  const latestHistoryEntry = historyEntries[0] ?? null;
  const latestHistoryLabel = latestHistoryEntry
    ? latestHistoryEntry.writingStyleLabel ||
      writingStylePresets[latestHistoryEntry.writingStyle]?.label ||
      latestHistoryEntry.writingStyle
    : "";
  const latestHistoryTimestamp = latestHistoryEntry
    ? new Date(latestHistoryEntry.createdAt).toLocaleString("ja-JP")
    : "";

  const punctuationModeLabels: Record<PunctuationMode, string> = {
    academic: "学術",
    japanese: "和文",
    western: "欧文",
  };

  const applyHistoryEntry = (
    entry: HistoryEntry,
    mode: HistoryRestoreMode,
    messageOverride?: string,
  ) => {
    const writingStyleLabel =
      entry.writingStyleLabel ||
      writingStylePresets[entry.writingStyle]?.label ||
      entry.writingStyle;

    if (mode === "output") {
      setText(entry.outputText);
      setPunctuationMode(entry.punctuationMode);
      setWritingStyle(entry.writingStyle);
      setStatusMessage(
        messageOverride ??
          `履歴から${writingStyleLabel}の変換結果を復元しました。`,
      );
      if (typeof entry.aiScore === "number") {
        const confidence = entry.aiConfidence
          ? entry.aiConfidence
          : inferConfidenceFromScore(entry.aiScore);
        const reasoning =
          entry.aiReasoning && entry.aiReasoning.trim().length > 0
            ? entry.aiReasoning
            : DEFAULT_AI_REASONING[confidence];
        setAiCheckResult({
          score: Math.round(entry.aiScore),
          confidence,
          reasoning,
          checkedAt: entry.aiCheckedAt ?? entry.createdAt,
          textSnapshot: entry.outputText,
        });
      } else {
        setAiCheckResult(null);
      }
      setAiCheckMessage(null);
    } else {
      setText(entry.inputText);
      setPunctuationMode(detectPunctuationMode(entry.inputText));
      setWritingStyle(entry.writingStyle);
      setStatusMessage(
        messageOverride ??
          "履歴に保存されていた変換前のテキストを復元しました。",
      );
      setAiCheckResult(null);
      setAiCheckMessage(null);
    }

    setDiffSegments(null);
    setActiveHistoryEntryId(entry.id);
  };

  const handleRestoreFromHistory = (
    entryId: string,
    mode: HistoryRestoreMode,
    messageOverride?: string,
  ) => {
    const targetEntry = historyEntries.find((entry) => entry.id === entryId);
    if (!targetEntry) {
      setStatusMessage("指定された履歴が見つかりませんでした。");
      return;
    }

    applyHistoryEntry(targetEntry, mode, messageOverride);
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
    let wasRemoved = false;

    setHistoryEntries((current) => {
      const next = current.filter((entry) => entry.id !== entryId);
      wasRemoved = next.length !== current.length;
      return wasRemoved ? next : current;
    });

    if (!wasRemoved) {
      setStatusMessage("指定された履歴が見つかりませんでした。");
      return;
    }

    setActiveHistoryEntryId((current) =>
      current === entryId ? null : current,
    );
    setStatusMessage("選択した履歴を削除しました。");
  };

  const handleUndoLastTransform = () => {
    if (!latestHistoryEntry) {
      setStatusMessage("巻き戻し可能なAI変換が見つかりませんでした。");
      return;
    }

    applyHistoryEntry(
      latestHistoryEntry,
      "input",
      "直近のAI変換を取り消し、元のテキストを復元しました。",
    );
  };

  const handleReapplyLastTransform = () => {
    if (!latestHistoryEntry) {
      setStatusMessage("再適用できるAI変換がありません。");
      return;
    }

    const label =
      latestHistoryEntry.writingStyleLabel ||
      writingStylePresets[latestHistoryEntry.writingStyle]?.label ||
      latestHistoryEntry.writingStyle;

    applyHistoryEntry(
      latestHistoryEntry,
      "output",
      `${label}の変換結果を再適用しました。`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="flex flex-col gap-4">
          <EditorTextareaSection
            text={text}
            onTextChange={handleTextChange}
            onClear={handleClearText}
            statusMessage={statusMessage}
            statusMessageId={statusMessageId}
            editorTitleId={editorTitleId}
            editorDescriptionId={editorDescriptionId}
            diffSegments={diffSegments}
            diffTitleId={diffTitleId}
            diffDescriptionId={diffDescriptionId}
          />
          <AiCheckerSection
            text={text}
            isCheckingAi={isCheckingAi}
            hasCheckedOnSameDay={hasCheckedOnSameDay}
            hasReachedDailyLimit={hasReachedDailyLimit}
            remainingAiChecks={remainingAiChecks}
            nextAiCheckLabel={nextAiCheckLabel}
            aiCheckMessage={aiCheckMessage}
            aiResult={aiResultForCurrentText}
            onInvokeAiCheck={handleInvokeAiCheck}
            dailyLimit={DAILY_AI_CHECK_LIMIT}
          />
        </div>
        <TransformationControls
          punctuationMode={punctuationMode}
          onPunctuationModeChange={handlePunctuationModeChange}
          onPunctuationCharacterReplace={handlePunctuationCharacterReplace}
          writingStyle={writingStyle}
          onWritingStyleChange={setWritingStyle}
          onInvokeStyleTransform={handleInvokeStyleTransform}
          isTransforming={isTransforming}
          onOpenHighAccuracyModal={handleOpenHighAccuracyModal}
          highAccuracyStatusLabel={highAccuracyStatusLabel}
          isHighAccuracyActive={isHighAccuracyActive}
        />
      </div>
      {latestHistoryEntry && (
        <LatestHistoryCard
          entry={latestHistoryEntry}
          writingStyleLabel={latestHistoryLabel}
          timestampLabel={latestHistoryTimestamp}
          punctuationModeLabel={
            punctuationModeLabels[latestHistoryEntry.punctuationMode]
          }
          onUndo={handleUndoLastTransform}
          onReapply={handleReapplyLastTransform}
          isTransforming={isTransforming}
        />
      )}
      <HistoryList
        entries={historyEntries}
        isLoading={!hasLoadedHistory}
        activeEntryId={activeHistoryEntryId}
        onRestore={handleRestoreFromHistory}
        isRestoreDisabled={isTransforming}
        onDeleteEntry={handleDeleteHistoryEntry}
      />
      <HighAccuracyModal
        isOpen={isHighAccuracyModalOpen}
        code={highAccuracyCode}
        onCodeChange={handleHighAccuracyCodeChange}
        onSubmit={handleActivateHighAccuracy}
        onClose={handleCloseHighAccuracyModal}
        isSubmitting={isActivatingHighAccuracy}
        errorMessage={highAccuracyError}
      />
    </div>
  );
}
