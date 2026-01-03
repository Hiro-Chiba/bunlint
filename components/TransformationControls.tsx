"use client";

import clsx from "clsx";
import { useEffect, useId, useState } from "react";

import {
  writingStylePresets,
  writingStyleSelectGroups,
  type WritingStyle,
} from "@/lib/gemini/index";
import type { PunctuationCharacter, PunctuationMode } from "@/lib/punctuation";

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
  onOpenHighAccuracyModal?: () => void;
  highAccuracyStatusLabel?: string | null;
  isHighAccuracyActive?: boolean;
};

const punctuationModeLabels: Record<PunctuationMode, string> = {
  japanese: "、。",
  academic: "，．",
  western: ",.",
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
  onOpenHighAccuracyModal,
  highAccuracyStatusLabel,
  isHighAccuracyActive = false,
}: TransformationControlsProps) {
  const selectId = useId();
  const helperId = useId();
  const fromSelectId = useId();
  const toSelectId = useId();
  const individualContentId = useId();
  const individualHeadingId = useId();

  const [fromCharacter, setFromCharacter] = useState<PunctuationCharacter>(",");
  const [toCharacter, setToCharacter] = useState<PunctuationCharacter>("、");
  const [isIndividualOpen, setIsIndividualOpen] = useState(false);
  const activePreset = writingStylePresets[writingStyle];

  const handleIndividualReplace = () => {
    if (!onPunctuationCharacterReplace) {
      return;
    }
    onPunctuationCharacterReplace(fromCharacter, toCharacter);
  };

  return (
    <div className="space-y-6">
      {/* Punctuation Style Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <h3 className="font-bold text-slate-800">句読点スタイル</h3>
        </header>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onPunctuationModeChange("japanese")}
            className={clsx(
              "flex w-full flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
              punctuationMode === "japanese"
                ? "border-slate-900 bg-slate-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-bold text-sm">標準</span>
              <span className="font-mono text-xs opacity-70">、。</span>
            </div>
            <span className="mt-1 text-xs opacity-80">一般的な日本語文章</span>
          </button>

          <button
            type="button"
            onClick={() => onPunctuationModeChange("academic")}
            className={clsx(
              "flex w-full flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
              punctuationMode === "academic"
                ? "border-slate-900 bg-slate-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-bold text-sm">理系・公用文</span>
              <span className="font-mono text-xs opacity-70">，．</span>
            </div>
            <span className="mt-1 text-xs opacity-80">論文やレポート向け</span>
          </button>

          <button
            type="button"
            onClick={() => onPunctuationModeChange("western")}
            className={clsx(
              "flex w-full flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
              punctuationMode === "western"
                ? "border-slate-900 bg-slate-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-bold text-sm">英文スタイル</span>
              <span className="font-mono text-xs opacity-70">,.</span>
            </div>
            <span className="mt-1 text-xs opacity-80">横書きの欧文混じり</span>
          </button>
        </div>

        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={() => setIsIndividualOpen((prev) => !prev)}
            aria-expanded={isIndividualOpen}
            aria-controls={individualContentId}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            個別設定を開く ›
          </button>
        </div>

        {isIndividualOpen && (
          <div
            id={individualContentId}
            className="mt-4 border-t border-slate-100 pt-4"
            aria-labelledby={individualHeadingId}
          >
            <h4
              id={individualHeadingId}
              className="mb-3 text-xs font-semibold text-slate-600"
            >
              句読点を個別に変換
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block" htmlFor={fromSelectId}>
                <span className="text-xs font-medium text-slate-500">
                  変換元
                </span>
                <select
                  id={fromSelectId}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
                <span className="text-xs font-medium text-slate-500">
                  変換先
                </span>
                <select
                  id={toSelectId}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
              className="mt-3 w-full rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleIndividualReplace}
              disabled={!onPunctuationCharacterReplace}
            >
              指定した記号に変換
            </button>
          </div>
        )}
      </section>

      {/* Tone Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-slate-400"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="font-bold text-slate-800">語尾・文体</h3>
        </header>

        <div className="space-y-4">
          <label className="block" htmlFor={selectId}>
            <select
              id={selectId}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
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

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">
              {activePreset?.label ?? writingStyle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {activePreset?.description ?? "このスタイルの説明は準備中です。"}
            </p>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!onInvokeStyleTransform || isTransforming}
            onClick={onInvokeStyleTransform}
            aria-busy={isTransforming || undefined}
          >
            {isTransforming ? (
              "変換中..."
            ) : (
              <>
                <span className="h-2 w-2 rounded-full border border-slate-400"></span>
                変換を実行
              </>
            )}
          </button>
        </div>
      </section>

      {/* High Accuracy Card */}
      <section className="relative overflow-hidden rounded-xl bg-slate-900 p-5 text-white shadow-lg">
        <div className="relative z-10">
          <header className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-yellow-500"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <h3 className="font-bold text-white">高精度モード</h3>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-slate-700"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </header>

          <p className="mb-6 text-xs leading-relaxed text-slate-400">
            AIを高精度で動作させます。10分間だけ利用できるプロ向け機能です。
          </p>

          {isHighAccuracyActive ? (
            <div className="rounded bg-emerald-900/30 px-3 py-2 text-center text-sm font-bold text-emerald-400 border border-emerald-800">
              {highAccuracyStatusLabel}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenHighAccuracyModal}
              className="flex w-full items-center justify-between rounded bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              アクセスコード
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
