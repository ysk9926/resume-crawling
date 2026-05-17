type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center">
      <h3 className="font-heading text-xl tracking-[-0.03em] text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
