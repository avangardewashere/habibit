import { X } from 'lucide-react';
import { CheckCircle } from './CheckCircle';

/**
 * One checkable line, shared by habits and tasks.
 *
 * The whole title area is the toggle so it is comfortable to hit with a thumb,
 * with delete as a separate 44px control beside it. Delete is always visible:
 * a hover-reveal would be unreachable on the phone this app is built for.
 */
export function ItemRow({
  title,
  checked,
  onToggle,
  onRemove,
  removeLabel,
}: {
  title: string;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex min-h-14 flex-1 touch-manipulation items-center gap-3 rounded-card px-4 py-2 text-left transition-transform duration-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-habibit-500"
      >
        <CheckCircle checked={checked} />
        <span
          className={[
            'min-w-0 break-words text-[15px] leading-snug transition-colors',
            checked ? 'text-ink-soft line-through' : 'text-ink',
          ].join(' ')}
        >
          {title}
        </span>
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full text-ink-soft/50 transition hover:bg-habibit-50 hover:text-habibit-600 active:scale-90 focus-visible:outline-2 focus-visible:outline-habibit-500"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </li>
  );
}
