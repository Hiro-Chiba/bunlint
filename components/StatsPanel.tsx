import clsx from "clsx";

import type { TextStats } from "@/lib/text";

const numberFormatter = new Intl.NumberFormat("ja-JP");

export type StatsHighlightMode = "none" | "words" | "sentences";

type StatsPanelProps = {
  stats: TextStats;
  activeHighlight: StatsHighlightMode;
  onHighlightChange: (mode: StatsHighlightMode) => void;
};

const statsLabels: Record<keyof TextStats, string> = {
  characters: "文字数",
  words: "単語数",
  sentences: "文数",
};

const interactiveModeByKey: Partial<Record<keyof TextStats, StatsHighlightMode>>
  = {
    words: "words",
    sentences: "sentences",
  };

const activeCardClassByMode: Record<Exclude<StatsHighlightMode, "none">, string>
  = {
    words: "border-emerald-400 bg-emerald-50 shadow-sm",
    sentences: "border-sky-400 bg-sky-50 shadow-sm",
  };

const focusRingClassByMode: Record<Exclude<StatsHighlightMode, "none">, string> =
  {
    words: "focus-visible:ring-emerald-200",
    sentences: "focus-visible:ring-sky-200",
  };

export function StatsPanel({
  stats,
  activeHighlight,
  onHighlightChange,
}: StatsPanelProps) {
  return (
    <section
      aria-label="テキスト統計情報"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {(Object.keys(stats) as Array<keyof TextStats>).map((key) => {
        const value = stats[key];
        const interactiveMode = interactiveModeByKey[key];
        const isInteractive = Boolean(interactiveMode);
        const isActive = interactiveMode && activeHighlight === interactiveMode;

        if (!isInteractive || !interactiveMode) {
          return (
            <div
              key={key}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">
                {statsLabels[key]}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-700">
                {numberFormatter.format(value)}
              </p>
            </div>
          );
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() =>
              onHighlightChange(
                activeHighlight === interactiveMode ? "none" : interactiveMode,
              )
            }
            aria-pressed={Boolean(isActive)}
            className={clsx(
              "rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition",
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isActive
                ? activeCardClassByMode[interactiveMode]
                : "hover:border-slate-300 hover:bg-slate-50",
              focusRingClassByMode[interactiveMode],
            )}
          >
            <p className="text-sm font-medium text-slate-500">
              {statsLabels[key]}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-700">
              {numberFormatter.format(value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              クリックで{statsLabels[key]}をハイライト
            </p>
          </button>
        );
      })}
    </section>
  );
}
