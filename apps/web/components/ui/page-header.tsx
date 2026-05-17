import type { ReactNode } from "react";

type PageHeaderStat = {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "muted";
};

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  stats?: PageHeaderStat[];
  action?: ReactNode;
};

export function PageHeader({
  title,
  description,
  stats = [],
  action,
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--rw-border)",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "14px 24px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--rw-foreground)",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "var(--rw-muted)",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action || stats.length > 0 ? (
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {stats.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
                borderLeft: "1px solid var(--rw-border)",
              }}
            >
              {stats.map((stat, index) => {
                const color =
                  stat.tone === "accent"
                    ? "var(--rw-accent)"
                    : stat.tone === "muted"
                    ? "var(--rw-muted)"
                    : "var(--rw-foreground)";
                return (
                  <div
                    key={`${stat.label}-${index}`}
                    style={{
                      minWidth: 120,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      padding: "12px 20px",
                      borderLeft: index > 0 ? "1px solid var(--rw-border)" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--rw-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color,
                      }}
                    >
                      {stat.value}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {action ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 20px",
                borderLeft: "1px solid var(--rw-border)",
              }}
            >
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
