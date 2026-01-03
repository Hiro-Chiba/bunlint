import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteTitle = "Bun Checker | 日本語テキスト整形スタジオ";
const siteDescription =
  "句読点を整え、AIで語尾を調整できる日本語向けエディタです。ブラウザーだけで手軽に文章を整えられます。";

export const metadata: Metadata = {
  metadataBase: new URL("https://bunlint.example.com"),
  applicationName: "Bun Checker",
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "テキスト変換",
    "AI変換",
    "句読点変換",
    "語尾調整",
    "日本語エディタ",
  ],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    locale: "ja_JP",
    siteName: "Bun Checker",
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
