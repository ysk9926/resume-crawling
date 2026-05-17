import type { Metadata } from "next";
import { Noto_Sans_KR, Space_Grotesk } from "next/font/google";

import { SiteNav } from "@/components/site-nav";

import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const bodyFont = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Resume Workbench",
  description: "취업 공고 수집, 이력서 버전 관리, 지원 현황 추적을 위한 로컬 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full font-sans">
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_35%),radial-gradient(circle_at_85%_0%,_rgba(59,130,246,0.12),_transparent_25%),linear-gradient(180deg,_#f6f3eb_0%,_#fdfcf8_55%,_#eef5f4_100%)]" />
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 md:px-10">
            <header className="mb-6 rounded-[34px] border border-white/70 bg-white/76 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                    Local-first hiring tracker
                  </p>
                  <h1 className="mt-3 font-heading text-4xl tracking-[-0.05em] text-slate-950 md:text-5xl">
                    Resume Workbench
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                    KOFIA 채용 공고를 수집하고, 이력서 템플릿을 버전별로 관리하고, 실제 지원 시점의
                    Markdown 스냅샷까지 남기는 개인용 워크벤치입니다.
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-slate-500">
                  <div className="rounded-2xl bg-slate-950 px-4 py-3 text-slate-100">
                    등록형 크롤러 구조: 코드로만 사이트 추가
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                    지원 건마다 이력서 스냅샷 저장
                  </div>
                </div>
              </div>
            </header>
            <SiteNav />
            <main className="mt-6 flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
