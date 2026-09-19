# Habibit: v3 Block A, theme menu

**Block:** A of 7 (v3) · **Date:** 2026-09-19 → 20 · **Status:** ✅ all green on CI, waiting for your sign-off

> **The three theme buttons are now one.** The header shows a single button with the current theme's
> icon; tapping it opens Light, Dark and Match device. Nothing about how themes behave has changed,
> and the tests below are how that's known rather than hoped.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The catch, and how it was handled

`docs/backlog.md` flagged this in v0.5. The old theme buttons did two jobs:

1. **drawing** the three buttons, and
2. on every page load, **setting the status-bar colour** to match your stored choice.

The inline script in the layout paints the page colours before anything shows. It doesn't touch the
status-bar colour, though. That was left to job 2. Move the buttons into a menu that only exists
while it's open, and job 2 stops running until you open it. With Dark stored on a light phone, you'd
get a cream status bar above a plum app on every load.

So the work went in two commits, as the plan said:

| Step | What changed | How it's known to be safe |
|---|---|---|
| **1. Split** | Job 2 moved into `ThemeEffect`, a component that draws nothing and is always on the page | No visible change; every existing theme test still passes |
| **2. Menu** | The buttons became `ThemeMenu`, which **only draws** | V3A-09 fails if the menu ever starts changing the page by itself again |

This follows the rule in `docs/backlog.md`: *a component should either draw something or cause an
effect, not both.* The old toggle was the one place that broke it.

---

## ⚠️ The bug CI found, and the fix

The first CI run failed **44 browser tests, every one of them a sign-in test**. A re-run failed the
same way, so it wasn't a fluke. The mutation run (below) gave it away: the same code *without*
`<ThemeEffect />` passed all of them.

**What was happening.** To pin the status bar, `applyTheme` **removed** the page's two
`theme-color` meta tags and added its own. But React rendered those tags, and it still owns them.
Before this block, that only ever ran on the home page, which never changes page. `ThemeEffect`
runs on *every* page, including the landing page of the emailed sign-in link. That page's last job
is to hop to `/`. On that hop React went to update the tags it had rendered, found them gone, and
crashed (`Cannot read properties of null (reading 'removeChild')`). You'd have tapped the link in
your email and been left on "Signing in…".

I reproduced it in the browser pane with the same hop, from `/auth/confirm` via "Back to Habibit".
The page errored and never showed the app.

**The fix, in two parts:**

1. `applyTheme` now **edits the tags' colours in place** and never adds or removes them. To force a
   theme, both tags (the light-device one and the dark-device one) get that theme's colour. The
   status bar looks exactly as before.
2. Checking the fix turned up a quieter second problem. On a page change Next renders **fresh**
   tags with the default colours, so the status bar went back to cream after the hop even with
   Dark chosen. `ThemeEffect` now **watches the head**: whenever a `theme-color` tag appears, it
   re-applies the theme to every such tag. That doesn't depend on when or how Next updates the head.

After both parts, in the browser pane: the same hop gives no errors, the app shows, and the status
bar stays plum.

---

## What's new on screen

- One round button in the header, beside the account button. Its icon is the current theme: sun,
  moon, or screen for Match device.
- Tapping it opens a small menu: **Light**, **Dark**, **Match device**. The current one is filled
  in and ticked.
- Picking one applies it, closes the menu, and puts focus back on the button. Escape or tapping
  anywhere else also closes it.
- Screen readers hear the button as "Theme: Dark" and each option as before ("Dark theme").

I checked it in the browser pane at 375px, with the device in dark mode. The menu fits inside the
screen. Picking Light closed the menu and pinned the status bar to cream. After a reload, with the
menu never opened, the status bar was still cream. The console had no errors.

---

## Tests

### New

| ID | What it proves | Test | Result |
|---|---|---|---|
| V3A-01 | ⭐ A stored dark theme pins the status bar on load, with nothing tapped | `components/theme/ThemeEffect.test.tsx` | ✅ 🔴 |
| V3A-02 | With no stored choice, the browser keeps both colours and follows the device | same | ✅ |
| V3A-03 | `ThemeEffect` draws nothing | same | ✅ |
| V3A-05 | The menu starts as one button naming the current theme, options hidden | `components/theme/ThemeMenu.test.tsx` | ✅ 🔴 |
| V3A-06 | Opening shows the three themes with the current one ticked | same | ✅ |
| V3A-07 | Picking applies and stores it, closes the menu, returns focus | same | ✅ 🔴 |
| V3A-08 | Escape closes and returns focus; a tap outside closes | same | ✅ |
| V3A-09 | The menu only draws: loading it changes nothing on the page | same | ✅ 🔴 |
| V3A-10 | ⭐ In a real browser: stored dark on a light phone, status bar plum on load, menu never opened | `e2e/theme.spec.ts` | ✅ 🔴 |
| V3A-11 | At 375px the open menu fits on screen with no sideways scroll | `e2e/layout.spec.ts` | ✅ |
| V3A-12 | ⭐ `applyTheme` edits the page's own tags and never swaps them out (the sign-in crash) | `lib/theme.dom.test.ts` | ✅ 🔴 |
| V3A-13 | ⭐ In a real browser: with Dark forced, leaving the sign-in page for the app works, with no errors and the status bar still plum | `e2e/theme.spec.ts` | ✅ |
| V3A-14 | Every copy of a tag is recoloured when the head holds two of each | `lib/theme.dom.test.ts` | ✅ 🔴 |
| V3A-15 | ⭐ Tags that appear later, as Next adds on a page change, are recoloured | `components/theme/ThemeEffect.test.tsx` | ✅ 🔴 |

### Changed

The existing browser tests used to tap the three header buttons directly. They now open the menu
first. What they check is unchanged:

| ID | Change | Result |
|---|---|---|
| V2A-30…35 | `choose()` opens the menu, picks, and checks the menu closed and the button names the choice | ✅ |
| V2A-33, 34, 35 | A forced theme is now checked as *both* tags showing its colour, instead of one pinned tag | ✅ |
| (unit) | The `applyTheme` tests in `lib/theme.dom.test.ts` rewritten the same way | ✅ |
| V2A-37 | Tap targets now include the theme button, then open the menu and measure all three options | ✅ |
| V2A-39 | The clean-console session picks Dark through the menu | ✅ |

---

## Mutation checks

Each guard was broken on purpose, the tests run, and the code restored.

| Broken on purpose | Caught by |
|---|---|
| `ThemeEffect` no longer applies the theme | V3A-01 |
| The menu applies the theme itself when it loads (the old two-jobs design) | V3A-09 |
| Picking a theme leaves the menu open | V3A-07 |
| Picking closes the menu but drops focus | V3A-07 |
| The button always says "Match device", whatever is chosen | V3A-05, V3A-07 |
| `<ThemeEffect />` removed from the layout (run on CI, draft PR #7, since closed) | **V3A-10, on android and desktop, and nothing else** |
| `applyTheme` removes the tags before adding its own (the sign-in crash) | V3A-12 |
| `ThemeEffect` stops watching the head | V3A-15 |
| Only the first copy of each tag is recoloured | V3A-14, V3A-15 |

The layout mutant is the one the unit tests can't see, because they render `ThemeEffect` directly.
Browser tests run only on CI, so it went through a throwaway draft PR.

**One oddity, reported as seen.** The first time I ran the "stops watching the head" mutant, three
unrelated tests (V3A-01 to 03) failed alongside V3A-15. Run again on its own, only V3A-15 failed,
and the real code then passed twice in a row. I couldn't reproduce the extra failures.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 262 | ✅ |
| Browser (Playwright), 80 tests × 2 devices | 160 runs | ✅ CI run 35454706836 |
| Database | 30 | ✅ |

---

## Optional check, yours

On your Android phone, after this is merged: pick Dark, close the app, open it again from the home
screen. The phone's status bar at the top should be plum straight away, before you touch anything.
