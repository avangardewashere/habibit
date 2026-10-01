'use client';

/**
 * The bar that offers to take a delete back.
 *
 * Purely presentational: it draws what it's given and reports taps and focus.
 * Whether it's showing, and for how long, is decided by UndoProvider — the same
 * split as ThemeMenu and ThemeEffect, so the timing can change without touching
 * the drawing.
 */
export function UndoBar({
  message,
  onUndo,
  onHold,
  onRelease,
}: {
  message: string;
  onUndo: () => void;
  /** The pointer or keyboard focus arrived: the bar must not vanish now. */
  onHold: () => void;
  /** It left again: the countdown may resume. */
  onRelease: () => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <div
        // Announced politely: it reports what just happened without interrupting.
        role="status"
        onPointerEnter={onHold}
        onPointerLeave={onRelease}
        onFocus={onHold}
        onBlur={onRelease}
        className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2 text-surface shadow-lg"
      >
        <p className="min-w-0 truncate text-sm font-bold">{message}</p>
        {/*
          Same colour as the message, set apart by weight and an underline — not
          the accent colour. Accent on this bar measured 2.08:1 in dark mode, far
          below the 4.5:1 text needs, on the one button that matters here.
          The pairing is guarded in lib/contrast.test.ts.
        */}
        <button
          type="button"
          onClick={onUndo}
          className="min-h-11 shrink-0 touch-manipulation rounded-full px-3 text-sm font-extrabold text-surface underline underline-offset-2 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
