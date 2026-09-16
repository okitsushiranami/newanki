import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#245ce5' };

export const metadata: Metadata = {
  title: "newanki — あなたの単語帳",
  description: "PCからCSVを取り込み、スマホで復習。学習の積み重ねが見える単語帳。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
