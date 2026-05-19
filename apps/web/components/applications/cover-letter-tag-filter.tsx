"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { inputStyle } from "@/components/ui/primitives";

export function CoverLetterTagFilter({ initialTag }: { initialTag: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialTag);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const currentTag = searchParams?.get("tag") ?? "";
      if (value === currentTag) {
        return;
      }

      const next = new URLSearchParams(searchParams?.toString() ?? "");
      const normalized = value.trim();
      if (normalized) {
        next.set("tag", normalized);
        next.set("page", "1");
      } else {
        next.delete("tag");
        next.delete("page");
      }

      const suffix = next.toString();
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [pathname, router, searchParams, value]);

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder="태그 입력 후 동일 태그 문항 검색"
      style={{ ...inputStyle, width: "100%" }}
    />
  );
}
