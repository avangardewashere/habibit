import type { ReactNode } from 'react';

export function SectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-xs font-extrabold uppercase tracking-widest text-ink-soft">{title}</h2>
      {trailing}
    </div>
  );
}
