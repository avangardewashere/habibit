import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { TodayLabel } from './TodayLabel';

export function Header() {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">
            {/* The wordmark stays brand coral in both themes — it is identity, not a role. */}
            Habi<span className="text-habibit-500">bit</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Little habits. Lots of love.</p>
        </div>
        <ThemeToggle />
      </div>
      <TodayLabel />
    </header>
  );
}
