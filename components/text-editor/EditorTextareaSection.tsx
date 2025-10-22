"use client";

import {
  type CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import clsx from "clsx";

import { extractWords, type TextStats } from "@/lib/text";
import type { DiffSegment } from "@/lib/diff";

import { StatsPanel, type StatsHighlightMode } from "../StatsPanel";

type EditorTextareaSectionProps = {
  text: string;
  onTextChange: (value: string) => void;
  statusMessage: string | null;
  statusMessageId: string;
  editorTitleId: string;
  editorDescriptionId: string;
  diffSegments: DiffSegment[] | null;
  diffTitleId: string;
  diffDescriptionId: string;
  stats: TextStats;
  highlightMode: StatsHighlightMode;
  onHighlightChange: (mode: StatsHighlightMode) => void;
};

const wordSegmentSplitter = /([\s]+)/;

type HighlightSegment = {
  value: string;
  type: "word" | "separator";
};

const parsePixelValue = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const createPaddingValue = (padding: string, border: string) =>
  `${parsePixelValue(padding) + parsePixelValue(border)}px`;

const createWordSegments = (value: string): HighlightSegment[] => {
  if (value.length === 0) {
    return [];
  }

  const words = extractWords(value);
  if (words.length === 0) {
    return value
      .split(wordSegmentSplitter)
      .filter((segment) => segment.length > 0)
      .map((segment) => ({
        value: segment,
        type: /\s+/.test(segment) ? "separator" : "word",
      }));
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const word of words) {
    const index = value.indexOf(word, cursor);
    if (index === -1) {
      return value
        .split(wordSegmentSplitter)
        .filter((segment) => segment.length > 0)
        .map((segment) => ({
          value: segment,
          type: /\s+/.test(segment) ? "separator" : "word",
        }));
    }

    if (index > cursor) {
      const separator = value.slice(cursor, index);
      if (separator.length > 0) {
        segments.push({ value: separator, type: "separator" });
      }
    }

    const token = value.slice(index, index + word.length);
    segments.push({ value: token, type: "word" });
    cursor = index + word.length;
  }

  if (cursor < value.length) {
    segments.push({ value: value.slice(cursor), type: "separator" });
  }

  return segments;
};

// ハイライト用オーバーレイでは改行位置をテキストエリアと揃える必要がある。
// 半角スペースをノーブレークスペースに変換すると折り返しが変わってしまうため、
// ここでは元の文字列をそのまま返して描画する。
const toDisplayValue = (segment: string) => segment;

export function EditorTextareaSection({
  text,
  onTextChange,
  statusMessage,
  statusMessageId,
  editorTitleId,
  editorDescriptionId,
  diffSegments,
  diffTitleId,
  diffDescriptionId,
  stats,
  highlightMode,
  onHighlightChange,
}: EditorTextareaSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightOverlayContentRef = useRef<HTMLDivElement | null>(null);
  const textareaScrollRef = useRef({ top: 0, left: 0 });
  const [highlightOverlayStyles, setHighlightOverlayStyles] =
    useState<CSSProperties>(() => ({
      boxSizing: "border-box",
      minHeight: "100%",
    }));

  const highlightOverlayContent = useMemo(() => {
    if (highlightMode !== "words" || text.length === 0) {
      return null;
    }

    const segments = createWordSegments(text);

    if (segments.length === 0) {
      return null;
    }

    return segments.map((segment, index) => (
      <span
        key={`word-${index}`}
        className={clsx(
          "box-decoration-clone rounded-sm",
          segment.type === "separator"
            ? "bg-emerald-100/70"
            : "bg-emerald-200/70 px-1",
        )}
      >
        {toDisplayValue(segment.value)}
      </span>
    ));
  }, [highlightMode, text]);

  const shouldShowHighlightOverlay = Boolean(highlightOverlayContent);

  const applyHighlightOverlayTransform = useCallback(
    (scrollLeft: number, scrollTop: number) => {
      textareaScrollRef.current.left = scrollLeft;
      textareaScrollRef.current.top = scrollTop;

      const overlayElement = highlightOverlayContentRef.current;
      if (overlayElement) {
        const nextTransform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;

        if (overlayElement.style.transform !== nextTransform) {
          overlayElement.style.transform = nextTransform;
        }
      }
    },
    [],
  );

  const syncHighlightOverlayMetrics = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const textareaElement = textareaRef.current;
    if (!textareaElement) {
      return;
    }

    const computed = window.getComputedStyle(textareaElement);
    const nextStyles: CSSProperties = {
      boxSizing: "border-box",
      minHeight: "100%",
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontStyle: computed.fontStyle,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      paddingTop: createPaddingValue(
        computed.paddingTop,
        computed.borderTopWidth,
      ),
      paddingRight: createPaddingValue(
        computed.paddingRight,
        computed.borderRightWidth,
      ),
      paddingBottom: createPaddingValue(
        computed.paddingBottom,
        computed.borderBottomWidth,
      ),
      paddingLeft: createPaddingValue(
        computed.paddingLeft,
        computed.borderLeftWidth,
      ),
      whiteSpace: computed.whiteSpace,
      wordBreak: computed.wordBreak as CSSProperties["wordBreak"],
      wordSpacing: computed.wordSpacing,
      textTransform: computed.textTransform as CSSProperties["textTransform"],
    };

    const textIndent = computed.textIndent;
    if (textIndent) {
      nextStyles.textIndent = textIndent;
    }

    const backgroundColor = computed.backgroundColor;
    if (
      backgroundColor &&
      backgroundColor !== "rgba(0, 0, 0, 0)" &&
      backgroundColor !== "transparent"
    ) {
      nextStyles.backgroundColor = backgroundColor;
    }

    const tabSize = computed.getPropertyValue("tab-size");
    if (tabSize) {
      const parsedTabSize = Number.parseFloat(tabSize);
      nextStyles.tabSize = Number.isNaN(parsedTabSize)
        ? tabSize
        : parsedTabSize;
    }

    setHighlightOverlayStyles(nextStyles);
    applyHighlightOverlayTransform(
      textareaElement.scrollLeft,
      textareaElement.scrollTop,
    );
  }, [applyHighlightOverlayTransform]);

  const textareaClassName = clsx(
    "min-h-[16rem] w-full resize-y rounded-md border border-slate-200 p-3 text-sm leading-relaxed shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
    shouldShowHighlightOverlay
      ? "relative z-20 bg-transparent caret-slate-800"
      : "bg-slate-50",
  );

  useLayoutEffect(() => {
    if (!shouldShowHighlightOverlay) {
      return;
    }

    syncHighlightOverlayMetrics();

    const textareaElement = textareaRef.current;
    if (!textareaElement) {
      return;
    }

    applyHighlightOverlayTransform(
      textareaElement.scrollLeft,
      textareaElement.scrollTop,
    );

    if (typeof ResizeObserver === "undefined") {
      if (typeof window !== "undefined") {
        const handleResize = () => {
          syncHighlightOverlayMetrics();
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
        };
      }

      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncHighlightOverlayMetrics();
    });

    resizeObserver.observe(textareaElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    shouldShowHighlightOverlay,
    highlightOverlayContent,
    applyHighlightOverlayTransform,
    syncHighlightOverlayMetrics,
  ]);

  const handleTextareaScroll = useCallback(
    (event: { currentTarget: HTMLTextAreaElement }) => {
      const { scrollLeft, scrollTop } = event.currentTarget;
      applyHighlightOverlayTransform(scrollLeft, scrollTop);
    },
    [applyHighlightOverlayTransform],
  );

  const textareaDescribedBy = statusMessage
    ? `${editorDescriptionId} ${statusMessageId}`
    : editorDescriptionId;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="space-y-1">
        <h2 id={editorTitleId} className="text-lg font-semibold text-slate-800">
          テキストエディタ
        </h2>
        <p id={editorDescriptionId} className="text-sm text-slate-500">
          テキストを入力すると、文字数や文数がリアルタイムに更新されます。
        </p>
      </header>
      <div className="relative">
        {shouldShowHighlightOverlay && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md bg-slate-50"
          >
            <div
              ref={highlightOverlayContentRef}
              className="h-full w-full whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-transparent"
              style={highlightOverlayStyles}
            >
              {highlightOverlayContent}
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={textareaClassName}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onScroll={handleTextareaScroll}
          placeholder="ここに文章を入力してください"
          aria-labelledby={editorTitleId}
          aria-describedby={textareaDescribedBy}
        />
      </div>
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
      <StatsPanel
        stats={stats}
        activeHighlight={highlightMode}
        onHighlightChange={onHighlightChange}
      />
    </section>
  );
}
