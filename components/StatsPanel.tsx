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

type BadgeVariant = "neutral" | "positive" | "warning" | "critical";

const badgeVariantClassNames: Record<BadgeVariant, { badge: string; value: string }> = {
  neutral: {
    badge:
      "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600",
    value: "text-slate-600",
  },
  positive: {
    badge:
      "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700",
    value: "text-emerald-600",
  },
  warning: {
    badge:
      "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700",
    value: "text-amber-600",
  },
  critical: {
    badge:
      "inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700",
    value: "text-rose-600",
  },
};

type StatBadgeRule = {
  upperBound: number | null;
  label: string;
  variant: BadgeVariant;
};

const statBadgeRules: Record<keyof TextStats, StatBadgeRule[]> = {
  characters: [
    { upperBound: 0, label: "未入力", variant: "neutral" },
    { upperBound: 400, label: "短文", variant: "positive" },
    { upperBound: 1000, label: "中くらい", variant: "warning" },
    { upperBound: null, label: "長文", variant: "critical" },
  ],
  words: [
    { upperBound: 0, label: "未入力", variant: "neutral" },
    { upperBound: 150, label: "短め", variant: "positive" },
    { upperBound: 300, label: "中くらい", variant: "warning" },
    { upperBound: null, label: "語数多め", variant: "critical" },
  ],
  sentences: [
    { upperBound: 0, label: "未入力", variant: "neutral" },
    { upperBound: 5, label: "短め", variant: "positive" },
    { upperBound: 12, label: "標準的", variant: "warning" },
    { upperBound: null, label: "文が多い", variant: "critical" },
  ],
};

function resolveBadge(
  key: keyof TextStats,
  value: number,
): { label: string; badgeClassName: string; valueClassName: string } {
  const rules = statBadgeRules[key];
  const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

  const matchedRule = rules.find((rule) => {
    if (rule.upperBound === null) {
      return true;
    }
    return normalizedValue <= rule.upperBound;
  }) ?? rules[rules.length - 1];

  const classes = badgeVariantClassNames[matchedRule.variant];

  return {
    label: matchedRule.label,
    badgeClassName: classes.badge,
    valueClassName: classes.value,
  };
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <section
      aria-label="テキスト統計情報"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {(Object.keys(stats) as Array<keyof TextStats>).map((key) => {
        const value = stats[key];
        const { label, badgeClassName, valueClassName } = resolveBadge(key, value);

        return (
          <div
            key={key}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-500">
                {statsLabels[key]}
              </p>
              <span className={badgeClassName}>{label}</span>
            </div>
            <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>
              {numberFormatter.format(value)}
            </p>
          </div>
        );
      })}
    </section>
  );
}
