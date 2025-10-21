import "./globals.css";

import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

const siteTitle = "bunlint（ブンリント） | テキスト変換スタジオ";
const siteDescription =
  "Gemini API と句読点変換で文章の語尾やスタイルを手早く整えられる日本語向けエディタです。";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: ["テキスト変換", "Gemini API", "句読点変換", "語尾調整"],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className={notoSans.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
