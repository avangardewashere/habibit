import { Check } from 'lucide-react';

/**
 * The check control, shared by habits and tasks.
 *
 * Presentational only — the surrounding row owns the button semantics, so this
 * is hidden from assistive tech to avoid announcing the state twice.
 */
export function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-150',
        checked
          ? 'scale-100 border-habibit-500 bg-habibit-500 text-white'
          : 'border-line bg-white text-transparent',
      ].join(' ')}
    >
      <Check className="h-4 w-4" strokeWidth={3.5} />
    </span>
  );
}
