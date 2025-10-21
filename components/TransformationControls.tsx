"use client";

import clsx from "clsx";
import { useId } from "react";

import { writingStylePresets, type WritingStyle } from "@/lib/gemini";
import type { PunctuationMode } from "@/lib/punctuation";

type TransformationControlsProps = {
  punctuationMode: PunctuationMode;
  onPunctuationModeChange: (mode: PunctuationMode) => void;
  writingStyle: WritingStyle;
  onWritingStyleChange: (style: WritingStyle) => void;
  onInvokeStyleTransform?: () => void;
  isTransforming?: boolean;
};

const punctuationModeLabels: Record<PunctuationMode, string> = {
  japanese: "和文（、。）",
  academic: "学術（，．）",
};

export function TransformationControls({
  punctuationMode,
  onPunctuationModeChange,
  writingStyle,
  onWritingStyleChange,
  onInvokeStyleTransform,
  isTransforming = false,
}: TransformationControlsProps) {
  const selectId = useId();
  const helperId = useId();

  return (
    <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">句読点スタイル</h3>
        <p className="mt-1 text-xs text-slate-500">
          ボタンを押すとテキスト全体の句読点を選択したスタイルに揃えます。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(punctuationModeLabels) as Array<PunctuationMode>).map(
            (mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onPunctuationModeChange(mode)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  mode === punctuationMode
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600",
                )}
                aria-pressed={mode === punctuationMode}
              >
                {punctuationModeLabels[mode]}
              </button>
            ),
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">語尾スタイル</h3>
        <p className="mt-1 text-xs text-slate-500" id={helperId}>
          Gemini API
          を利用して語尾やトーンを整えます。スタイルによって文章全体の印象が変わります。
        </p>
        <label className="mt-3 block" htmlFor={selectId}>
          <span className="text-xs font-medium text-slate-500">スタイル</span>
          <select
            id={selectId}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={writingStyle}
            aria-describedby={helperId}
            onChange={(event) =>
              onWritingStyleChange(event.target.value as WritingStyle)
            }
          >
            {(Object.keys(writingStylePresets) as Array<WritingStyle>).map(
              (value) => (
                <option key={value} value={value}>
                  {writingStylePresets[value].label}
                </option>
              ),
            )}
          </select>
        </label>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {(
            Object.entries(writingStylePresets) as Array<
              [WritingStyle, (typeof writingStylePresets)[WritingStyle]]
            >
          ).map(([value, preset]) => (
            <li key={value}>
              <span className="font-medium text-slate-600">{preset.label}</span>
              ：{preset.description}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 inline-flex items-center justify-center rounded-md border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 shadow-sm transition-colors hover:bg-brand-50 disabled:border-slate-300 disabled:text-slate-400"
          disabled={!onInvokeStyleTransform || isTransforming}
          onClick={onInvokeStyleTransform}
          aria-busy={isTransforming || undefined}
        >
          {isTransforming ? "変換中..." : "語尾変換を実行"}
        </button>
      </div>
    </section>
  );
}
