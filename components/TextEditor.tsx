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

import {
  HistoryList,
  type HistoryEntry,
  type HistoryRestoreMode,
} from "./HistoryList";
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
  const [activeHistoryEntryId, setActiveHistoryEntryId] = useState<string | null>(
    null,
  );

  const editorTitleId = useId();
  const editorDescriptionId = useId();
  const statusMessageId = useId();
  const diffTitleId = useId();
  const diffDescriptionId = useId();

  const stats = useMemo(() => getTextStats(text), [text]);

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
            console.error(
              "履歴のユーザー別領域への移行に失敗しました",
              error,
            );
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

      if (normalized.length > 0) {
        setHistoryEntries(normalized);
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

  const handleTextChange = (value: string) => {
    setText(value);
    setPunctuationMode(detectPunctuationMode(value));
    setStatusMessage(null);
    setDiffSegments(null);
    setActiveHistoryEntryId(null);
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
    setActiveHistoryEntryId(null);
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
        const next = [entry, ...current];
        return next.slice(0, MAX_HISTORY_ITEMS);
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

  const textareaDescribedBy = statusMessage
    ? `${editorDescriptionId} ${statusMessageId}`
    : editorDescriptionId;

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
        messageOverride ?? `履歴から${writingStyleLabel}の変換結果を復元しました。`,
      );
    } else {
      setText(entry.inputText);
      setPunctuationMode(detectPunctuationMode(entry.inputText));
      setWritingStyle(entry.writingStyle);
      setStatusMessage(
        messageOverride ?? "履歴に保存されていた変換前のテキストを復元しました。",
      );
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
      {latestHistoryEntry && (
        <section className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/60 p-4 text-sm shadow-sm">
          <header className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-brand-700">直近のAI変換</h3>
            <p className="text-xs text-brand-600">
              {latestHistoryTimestamp}
              {latestHistoryLabel ? ` / ${latestHistoryLabel}` : ""}
              {` / ${punctuationModeLabels[latestHistoryEntry.punctuationMode]}`}
            </p>
          </header>
          <div className="grid gap-3 text-xs text-slate-700">
            <div>
              <p className="font-semibold text-slate-600">変換後</p>
              <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-brand-100 bg-white p-2 text-slate-700">
                {latestHistoryEntry.outputText || latestHistoryEntry.inputText}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-600">変換前</p>
              <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-brand-50 bg-brand-50/40 p-2 text-slate-600">
                {latestHistoryEntry.inputText}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={handleUndoLastTransform}
              disabled={isTransforming}
              className="rounded-md border border-brand-300 bg-white px-3 py-1 font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              元のテキストに戻す
            </button>
            <button
              type="button"
              onClick={handleReapplyLastTransform}
              disabled={isTransforming}
              className="rounded-md border border-brand-500 bg-brand-600 px-3 py-1 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              変換結果を再適用
            </button>
          </div>
          <p className="text-xs text-brand-700/80">
            巻き戻しはエディタの内容を即座に置き換えます。履歴から別の結果を選ぶことで、任意の変換を復元できます。
          </p>
        </section>
      )}
      <HistoryList
        entries={historyEntries}
        isLoading={!hasLoadedHistory}
        activeEntryId={activeHistoryEntryId}
        onRestore={handleRestoreFromHistory}
        isRestoreDisabled={isTransforming}
      />
    </div>
  );
}
