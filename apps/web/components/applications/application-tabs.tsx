import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type ApplicationTabKey = "info" | "cover" | "timeline";

type TabConfig = {
  key: ApplicationTabKey;
  label: string;
};

type ApplicationTabsProps = {
  active: ApplicationTabKey;
  basePath: string;
  preservedSearch: string;
  children: ReactNode;
  hideCoverTab?: boolean;
};

const TABS: TabConfig[] = [
  { key: "info", label: "지원 정보" },
  { key: "cover", label: "지원 자소서" },
  { key: "timeline", label: "타임라인" },
];

const tabsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  padding: "0 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
  gap: 4,
};

const tabBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--rw-muted)",
  textDecoration: "none",
  borderBottomWidth: 2,
  borderBottomStyle: "solid",
  borderBottomColor: "transparent",
  marginBottom: -1,
  transition: "color 150ms ease, border-color 150ms ease",
};

const tabActiveStyle: CSSProperties = {
  ...tabBaseStyle,
  color: "var(--rw-foreground)",
  borderBottomColor: "var(--rw-accent)",
};

export function ApplicationTabs({
  active,
  basePath,
  preservedSearch,
  children,
  hideCoverTab,
}: ApplicationTabsProps) {
  const visibleTabs = TABS.filter((tab) => !(hideCoverTab && tab.key === "cover"));

  return (
    <>
      <div style={tabsRowStyle} role="tablist">
        {visibleTabs.map((tab) => {
          const isActive = tab.key === active;
          const href = buildTabHref(basePath, tab.key, preservedSearch);
          return (
            <Link
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              href={href}
              style={isActive ? tabActiveStyle : tabBaseStyle}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </>
  );
}

function buildTabHref(
  basePath: string,
  tabKey: ApplicationTabKey,
  preservedSearch: string,
): string {
  const params = new URLSearchParams(preservedSearch);
  if (tabKey === "info") {
    params.delete("tab");
  } else {
    params.set("tab", tabKey);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
