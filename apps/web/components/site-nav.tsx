"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/postings", label: "공고" },
  { href: "/resumes", label: "이력서" },
  { href: "/applications", label: "지원 현황" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-[28px] border border-white/60 bg-white/70 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={[
                  "inline-flex rounded-full px-4 py-2 text-sm font-medium transition",
                  active
                    ? "bg-emerald-700 text-white shadow-[0_10px_30px_rgba(6,95,70,0.25)]"
                    : "text-slate-600 hover:bg-white hover:text-slate-950",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
