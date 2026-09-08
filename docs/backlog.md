# Backlog

Things deliberately deferred, with enough context to pick them up cold. Not a
roadmap — the version plan lives in the QA docs and the session plan. This is for
"we decided not to do that yet, and here is why."

---

## Move the theme control into a popup

**Raised:** 2026-09-09, after v0.5 Block B shipped.
**Status:** deferred, current version is fine.

The theme control is currently three always-visible buttons in the header
(`components/ui/ThemeToggle.tsx`), about 136×44px. It works, but it spends a lot of
a phone's header on something you touch roughly twice a year. The intent is to
collapse it into a popup or menu behind a single icon, and spend the reclaimed
space on information — a streak count, today's progress, a date strip.

**One real catch before anyone does this.** `ThemeToggle` currently owns two
unrelated jobs:

1. rendering the three buttons, and
2. a `useIsomorphicLayoutEffect` that calls `applyTheme(preference)` on mount,
   which is what syncs the `theme-color` metas with whatever the pre-paint inline
   script already applied.

Job 2 must run on **every page load**. If the toggle moves inside a popup that only
mounts when opened, that effect stops running until the user opens the popup — and
the status bar silently goes stale. This is the same class of bug as the one found
in Block B QA, where the metas were pinned to the last tapped value.

**So: split it first.** Move the `applyTheme` effect out into something always
mounted — a headless `ThemeEffect` component rendered next to `HabibitProvider`, or
into the provider itself. Then the visible control becomes purely presentational and
can be swapped for a popup, a settings sheet, or anything else without touching
theme behaviour. Do the split as its own change, not bundled into the popup work.

---

## Componentisation, generally

**Raised:** 2026-09-09.

The stated preference is that pieces stay swappable as the project grows, so a
change like the one above is a local edit rather than a hunt.

Where the codebase already does this well, and should stay this way:

- **`components/ui/`** holds presentational primitives (`ItemRow`, `Composer`,
  `CheckCircle`, `EmptyState`, `SectionHeader`) that know nothing about habits or
  tasks. `ItemRow` is used by both sections; the *meaning* of a row lives in the
  section, not the row.
- **`lib/`** is pure logic with no React — `storage`, `date`, `titles`, `theme`.
  That is why it is testable without a browser.
- **`store/`** owns state and is the only place that talks to `lib/storage`.
- Colour lives in **semantic tokens**, so re-theming touches CSS variables rather
  than components.

The rule of thumb worth keeping: **a component should either render something or
cause an effect, not both.** The `ThemeToggle` case above is the one place that is
currently violated, and it is exactly the place that turned out to be hard to move.
