import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/ui/sidebar";
import { getViewer } from "@/lib/api";
import { isPublicPath } from "@/lib/session";

import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Workbench",
  description: "취업 공고 수집, 이력서 버전 관리, 지원 현황 추적을 위한 로컬 도구",
};

export const preferredRegion = "icn1";

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-rw-pathname") ?? "/";
  const publicPath = isPublicPath(pathname);
  const viewer = publicPath ? null : await getViewer().catch(() => null);

  if (!publicPath && viewer === null) {
    redirect("/login");
  }

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css"
        />
      </head>
      <body suppressHydrationWarning>
        {publicPath ? (
          children
        ) : (
          <div
            style={{
              display: "flex",
              height: "100vh",
              overflow: "hidden",
            }}
          >
            <Suspense fallback={null}>
              <Sidebar viewer={viewer} />
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
        )}
      </body>
    </html>
  );
}
