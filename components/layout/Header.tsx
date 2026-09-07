import { TodayLabel } from './TodayLabel';

export function Header() {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">
        Habi<span className="text-habibit-500">bit</span>
      </h1>
      <p className="mt-1 text-sm text-ink-soft">Little habits. Lots of love.</p>
      <TodayLabel />
    </header>
  );
}
