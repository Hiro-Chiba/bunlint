import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteTitle = "【仮】bunlint（ブンリント） | 日本語テキスト整形スタジオ";
const siteDescription =
  "公開準備中の bunlint（ブンリント）は、句読点スタイルの統一と Gemini API を活用した語尾調整で文章をすばやく整えられる日本語向けエディタです。";

export const metadata: Metadata = {
  metadataBase: new URL("https://bunlint.example.com"),
  applicationName: "bunlint（仮）",
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "テキスト変換",
    "Gemini API",
    "句読点変換",
    "語尾調整",
    "日本語エディタ",
  ],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    locale: "ja_JP",
    siteName: "bunlint（仮）",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
