import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";

import "./globals.css";

const sans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  variable: "--font-admin-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-admin-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Crawler Admin Console",
  description: "로컬 전용 크롤링 관리자 콘솔",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
