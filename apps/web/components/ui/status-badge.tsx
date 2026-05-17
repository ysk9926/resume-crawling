type Tone = "neutral" | "info" | "success" | "warning" | "danger";

type StatusBadgeProps = {
  label: string;
  tone?: Tone;
};

const tonePalette: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "#f5f5f5", fg: "#525252", border: "#e5e5e5" },
  info: { bg: "#eff6ff", fg: "#1d4ed8", border: "#dbeafe" },
  success: { bg: "#ecfdf5", fg: "#047857", border: "#d1fae5" },
  warning: { bg: "#fff7ed", fg: "#b45309", border: "#fed7aa" },
  danger: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const palette = tonePalette[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 2,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
