"use client";

import { useMemo, useState } from "react";

import {
  convertPunctuation,
  detectPunctuationMode,
  type PunctuationMode,
} from "@/lib/punctuation";
import { getTextStats } from "@/lib/text";

import { HistoryList } from "./HistoryList";
import { StatsPanel } from "./StatsPanel";
import {
  TransformationControls,
  type WritingStyle,
} from "./TransformationControls";

export function TextEditor() {
  const [text, setText] = useState("これはサンプルテキストです。自由に編集して機能をお試しください。");
  const [punctuationMode, setPunctuationMode] = useState<PunctuationMode>(
    () => detectPunctuationMode(text),
  );
  const [writingStyle, setWritingStyle] = useState<WritingStyle>("desumasu");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const stats = useMemo(() => getTextStats(text), [text]);

  const handleTextChange = (value: string) => {
    setText(value);
    setPunctuationMode(detectPunctuationMode(value));
    setStatusMessage(null);
  };

  const handlePunctuationModeChange = (mode: PunctuationMode) => {
    if (mode === punctuationMode) {
      return;
    }

    const converted = convertPunctuation(text, mode);
    setText(converted);
    setPunctuationMode(mode);
    setStatusMessage(
      mode === "academic"
        ? "句読点を学術スタイル（，．）に変換しました。"
        : "句読点を和文スタイル（、。）に変換しました。",
    );
  };

  const handleInvokeStyleTransform = () => {
    setStatusMessage(
      "Gemini API との連携は準備中です。後日のアップデートで語尾変換が利用可能になります。",
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-800">テキストエディタ</h2>
            <p className="text-sm text-slate-500">
              テキストを入力すると、文字数や文数がリアルタイムに更新されます。
            </p>
          </header>
          <textarea
            className="min-h-[16rem] w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder="ここに文章を入力してください"
          />
          {statusMessage && (
            <div
              role="status"
              className="rounded-md border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700"
            >
              {statusMessage}
            </div>
          )}
          <StatsPanel stats={stats} />
        </section>
        <TransformationControls
          punctuationMode={punctuationMode}
          onPunctuationModeChange={handlePunctuationModeChange}
          writingStyle={writingStyle}
          onWritingStyleChange={setWritingStyle}
          onInvokeStyleTransform={handleInvokeStyleTransform}
        />
      </div>
      <HistoryList entries={[]} />
    </div>
  );
}
