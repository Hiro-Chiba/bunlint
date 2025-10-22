"use client";

import clsx from "clsx";
import { useId, useState } from "react";

import {
  writingStylePresets,
  writingStyleSelectGroups,
  type WritingStyle,
} from "@/lib/gemini";
import type {
  PunctuationCharacter,
  PunctuationMode,
} from "@/lib/punctuation";

type TransformationControlsProps = {
  punctuationMode: PunctuationMode;
  onPunctuationModeChange: (mode: PunctuationMode) => void;
  onPunctuationCharacterReplace?: (
    from: PunctuationCharacter,
    to: PunctuationCharacter,
  ) => void;
  writingStyle: WritingStyle;
  onWritingStyleChange: (style: WritingStyle) => void;
  onInvokeStyleTransform?: () => void;
  isTransforming?: boolean;
};

const punctuationModeLabels: Record<PunctuationMode, string> = {
  japanese: "和文（、。）",
  academic: "学術（，．）",
  western: "欧文（,.）",
};

const punctuationSelectOptions: Array<{
  value: PunctuationCharacter;
  label: string;
}> = [
  { value: "、", label: "、（全角読点）" },
  { value: "。", label: "。（全角句点）" },
  { value: "，", label: "，（全角カンマ）" },
  { value: "．", label: "．（全角ピリオド）" },
  { value: ",", label: ",（半角カンマ）" },
  { value: ".", label: ".（半角ピリオド）" },
];

export function TransformationControls({
  punctuationMode,
  onPunctuationModeChange,
  onPunctuationCharacterReplace,
  writingStyle,
  onWritingStyleChange,
  onInvokeStyleTransform,
  isTransforming = false,
}: TransformationControlsProps) {
  const selectId = useId();
  const helperId = useId();
  const fromSelectId = useId();
  const toSelectId = useId();

  const [fromCharacter, setFromCharacter] = useState<PunctuationCharacter>(",");
  const [toCharacter, setToCharacter] = useState<PunctuationCharacter>("、");
  const activePreset = writingStylePresets[writingStyle];

  const handleIndividualReplace = () => {
    if (!onPunctuationCharacterReplace) {
      return;
    }

    onPunctuationCharacterReplace(fromCharacter, toCharacter);
  };

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

        <div className="mt-6 rounded-md border border-slate-100 bg-slate-50 p-3">
          <h4 className="text-xs font-semibold text-slate-600">
            句読点を個別に変換
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            「,」「.」「、」「。」などの記号を指定して置き換えられます。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block" htmlFor={fromSelectId}>
              <span className="text-xs font-medium text-slate-500">変換元</span>
              <select
                id={fromSelectId}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                value={fromCharacter}
                onChange={(event) =>
                  setFromCharacter(event.target.value as PunctuationCharacter)
                }
              >
                {punctuationSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block" htmlFor={toSelectId}>
              <span className="text-xs font-medium text-slate-500">変換先</span>
              <select
                id={toSelectId}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                value={toCharacter}
                onChange={(event) =>
                  setToCharacter(event.target.value as PunctuationCharacter)
                }
              >
                {punctuationSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            onClick={handleIndividualReplace}
            disabled={!onPunctuationCharacterReplace}
          >
            指定した記号に変換
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">語尾スタイル</h3>
        <p className="mt-1 text-xs text-slate-500" id={helperId}>
          AIを利用して語尾やトーンを整えます。スタイルによって文章全体の印象が変わります。
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
            {writingStyleSelectGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.styles.map((value) => (
                  <option key={value} value={value}>
                    {writingStylePresets[value].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <ul className="mt-2 space-y-3 text-xs text-slate-500">
          {writingStyleSelectGroups.map((group) => (
            <li key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <ul className="mt-1 space-y-1">
                {group.styles.map((value) => {
                  const preset = writingStylePresets[value];
                  return (
                    <li key={value}>
                      <span className="font-medium text-slate-600">
                        {preset.label}
                      </span>
                      ：{preset.description}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        {activePreset?.sample && (
          <div className="mt-3 space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <h4 className="text-xs font-semibold text-slate-600">
              サンプル（{activePreset.label}）
            </h4>
            {activePreset.sample.note ? (
              <p className="text-[11px] text-slate-500">{activePreset.sample.note}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="font-medium text-slate-500">変換前</span>
                <p className="mt-1 whitespace-pre-line rounded border border-slate-200 bg-white/60 p-2 text-[11px] text-slate-600">
                  {activePreset.sample.before}
                </p>
              </div>
              <div>
                <span className="font-medium text-slate-500">変換後</span>
                <p className="mt-1 whitespace-pre-line rounded border border-slate-200 bg-white/60 p-2 text-[11px] text-slate-600">
                  {activePreset.sample.after}
                </p>
              </div>
            </div>
          </div>
        )}
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
