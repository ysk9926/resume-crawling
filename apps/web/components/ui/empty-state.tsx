type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        color: "var(--rw-muted)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--rw-foreground)" }}>
        {title}
      </div>
      {description ? (
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>{description}</div>
      ) : null}
    </div>
  );
}
