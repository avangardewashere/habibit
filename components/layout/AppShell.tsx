import type { ReactNode } from 'react';

/**
 * The single column every screen lives in. On a phone it fills the width; on a
 * desktop it stays phone-width and centred, which is the honest layout for a
 * mobile-first app rather than a stretched one.
 *
 * The safe-area insets matter once installed: without the bottom one the last
 * row sits under the iPhone home indicator, and without left/right a notch eats
 * one edge in landscape. `max()` keeps the normal padding on devices with no
 * insets. These only resolve because the layout sets `viewportFit: 'cover'`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto flex w-full max-w-md flex-col pt-[max(2.5rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
        {children}
      </div>
    </div>
  );
}
