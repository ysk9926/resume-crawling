"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import {
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineDocumentText,
  HiOutlineBriefcase,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
} from "react-icons/hi";
import type { IconType } from "react-icons";

const STORAGE_KEY = "rw-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: IconType;
};

const navigation: NavItem[] = [
  { href: "/", label: "대시보드", icon: HiOutlineChartBar },
  { href: "/postings", label: "공고", icon: HiOutlineClipboardList },
  { href: "/resumes", label: "이력서", icon: HiOutlineDocumentText },
  { href: "/applications", label: "지원 현황", icon: HiOutlineBriefcase },
];

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        margin: "0 8px",
        padding: collapsed ? "8px 0" : "8px 12px",
        borderRadius: 4,
        textDecoration: "none",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        backgroundColor: active ? "var(--rw-sidebar-active)" : "transparent",
        color: active ? "var(--rw-accent)" : "var(--rw-foreground)",
        transition: "background-color 0.15s, color 0.15s",
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {collapsed ? null : item.label}
    </Link>
  );
}

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeStorage,
    getCollapsed,
    () => false,
  );

  const toggle = useCallback(() => {
    const next = !getCollapsed();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // ignore
    }
  }, []);

  const width = collapsed ? 64 : 220;

  return (
    <aside
      style={{
        width,
        minWidth: width,
        backgroundColor: "var(--rw-sidebar-bg)",
        borderRight: "1px solid var(--rw-border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        transition: "width 0.2s ease, min-width 0.2s ease",
      }}
    >
      <div
        style={{
          height: 56,
          flexShrink: 0,
          padding: collapsed ? "0 8px" : "0 12px 0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          borderBottom: "1px solid var(--rw-border)",
        }}
      >
        {collapsed ? null : (
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--rw-accent)",
              letterSpacing: "-0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Resume Workbench
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--rw-border)",
            borderRadius: 4,
            backgroundColor: "transparent",
            color: "var(--rw-muted)",
            cursor: "pointer",
          }}
        >
          {collapsed ? <HiChevronDoubleRight size={14} /> : <HiChevronDoubleLeft size={14} />}
        </button>
      </div>

      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto", minHeight: 0 }}>
        {navigation.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div
        style={{
          flexShrink: 0,
          padding: collapsed ? "12px 8px" : "12px 20px",
          borderTop: "1px solid var(--rw-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          fontSize: 11,
          color: "var(--rw-muted)",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: "var(--rw-success)",
            flexShrink: 0,
          }}
        />
        {collapsed ? null : <span>로컬 전용 워크벤치</span>}
      </div>
    </aside>
  );
}
