import type { TextStats } from "@/lib/text";

const numberFormatter = new Intl.NumberFormat("ja-JP");

type StatsPanelProps = {
  stats: TextStats;
};

const statsLabels: Record<keyof TextStats, string> = {
  characters: "文字数",
  words: "単語数",
  sentences: "文数",
};

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <section
      aria-label="テキスト統計情報"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {(Object.keys(stats) as Array<keyof TextStats>).map((key) => (
        <div
          key={key}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">
            {statsLabels[key]}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {numberFormatter.format(stats[key])}
          </p>
        </div>
      ))}
    </section>
  );
}
