export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 py-7 text-center">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{hint}</p>
    </div>
  );
}
