"use client";

import type { FormEvent } from "react";
import { useEffect, useRef } from "react";

type HighAccuracyModalProps = {
  isOpen: boolean;
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
};

export function HighAccuracyModal({
  isOpen,
  code,
  onCodeChange,
  onSubmit,
  onClose,
  isSubmitting,
  errorMessage,
}: HighAccuracyModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(id);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-hidden="true"
        onClick={handleOverlayClick}
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="high-accuracy-modal-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="high-accuracy-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              高精度モードを有効化
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              特別な暗号を入力すると、10分間だけより精度の高いモデルを利用できます。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-transparent px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="モーダルを閉じる"
          >
            ✕
          </button>
        </div>
        <label className="mt-6 block text-sm" htmlFor="high-accuracy-secret">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            特別な暗号
          </span>
          <input
            id="high-accuracy-secret"
            ref={inputRef}
            type="password"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="暗号を入力してください"
            autoComplete="off"
            required
            disabled={isSubmitting}
          />
        </label>
        {errorMessage ? (
          <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            暗号は管理者から共有されたものを入力してください。
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded-md border border-brand-500 bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? "認証中..." : "有効化"}
          </button>
        </div>
      </form>
    </div>
  );
}
