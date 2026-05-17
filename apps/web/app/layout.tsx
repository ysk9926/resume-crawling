import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { Sidebar } from "@/components/ui/sidebar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Workbench",
  description: "취업 공고 수집, 이력서 버전 관리, 지원 현황 추적을 위한 로컬 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css"
        />
      </head>
      <body suppressHydrationWarning>
        <div
          style={{
            display: "flex",
            height: "100vh",
            overflow: "hidden",
          }}
        >
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
