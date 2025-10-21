"use client";

import { useMemo, useState } from "react";

import {
  convertPunctuation,
  detectPunctuationMode,
  type PunctuationMode,
} from "@/lib/punctuation";
import { getTextStats } from "@/lib/text";
import { writingStylePresets, type WritingStyle } from "@/lib/gemini";

import { HistoryList } from "./HistoryList";
import { StatsPanel } from "./StatsPanel";
import { TransformationControls } from "./TransformationControls";

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

  const handleInvokeStyleTransform = async () => {
    if (isTransforming) {
      return;
    }

    if (!text.trim()) {
      setStatusMessage("語尾変換を行うテキストを入力してください。");
      return;
    }

    setIsTransforming(true);
    setStatusMessage("Gemini API にリクエストを送信しています...");

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

      let payload: TransformSuccessResponse | TransformErrorResponse | null = null;

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
        setStatusMessage("Gemini API から結果を取得できませんでした。");
        return;
      }

      const result = payload;
      setText(result.outputText);
      setPunctuationMode(result.punctuationMode);

      const preset = writingStylePresets[result.writingStyle] ??
        writingStylePresets[writingStyle];
      const successMessage =
        (result.message && result.message.trim())
          ? result.message
          : `Gemini API で${preset.label}に整形しました。`;
      setStatusMessage(successMessage);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "ネットワークエラーが発生しました。通信環境をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-800">
              テキストエディタ
            </h2>
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
          isTransforming={isTransforming}
        />
      </div>
      <HistoryList entries={[]} />
    </div>
  );
}
