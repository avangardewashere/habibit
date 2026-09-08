'use client';

import { TriangleAlert } from 'lucide-react';
import { useHabibit } from '@/store/HabibitProvider';

/**
 * Shown only if a write to storage has actually failed — quota exceeded, or a
 * browser configured to block it. Invisible the rest of the time.
 *
 * Worth the few lines: an app that silently pretends to save your habits is a
 * far worse failure than one that admits it cannot.
 */
export function SaveWarning() {
  const { saveFailed } = useHabibit();
  if (!saveFailed) return null;

  return (
    <p
      role="alert"
      className="mb-5 flex items-start gap-2 rounded-card border border-accent bg-badge-bg px-4 py-3 text-sm text-ink"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={2.5} />
      <span>
        <strong className="font-bold">Not saving.</strong> Your browser is blocking storage or is out
        of room, so changes will be lost when you close this tab.
      </span>
    </p>
  );
}
