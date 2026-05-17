type StatusPillProps = {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
};

const toneClassName = {
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-sky-100 text-sky-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClassName[tone]}`}>
      {label}
    </span>
  );
}
