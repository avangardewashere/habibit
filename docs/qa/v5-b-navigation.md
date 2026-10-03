# Habibit: v5 Block B, somewhere to go

**Block:** B of 3 (v5) · **Date:** 2026-10-04 · **Status:** ✅ locally: 653 unit / 9 DST / 280 browser all green; database 107/107 on its clean runs, with an unrelated local flake explained below. Waiting for your sign-off. Not merged, and nothing is deployed

> **Habibit now has three places, not one.** A bar along the bottom moves between **Today** (the
> list, as before), **Progress** (this week, the headline numbers, and every habit's history) and
> **Settings** (theme, account and sync, about). The header is down to the wordmark, the date and
> the account button.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The decisions in this block

| Decision | Choice | Why |
|---|---|---|
| Three pages, or three views of one | **Views of one page**, named in the address as `#progress` / `#settings` | below |
| How the tabs move | **Plain links** (`<a href="#progress">`) | the browser already does history, Back and refresh for links |
| Where the account button goes | **Stays in Today's header**, and its panel also appears in Settings | a face top-right is where people look, and it carries the sync dot |
| The theme and review buttons | **Leave the header**: theme → Settings, review → Progress | each now has a place of its own |
| The privacy link | **Settings → About**, instead of a lone footer link | reachable from every screen, signed in or not |

**Why one page.** The service worker keeps the one page this app has, and an address it hasn't
seen falls back to that page when there's no signal. A real `/progress` opened offline would
quietly show Today. Every screen added since v2 has been a sheet for exactly this reason. A hash
never leaves the browser, so a link to `#settings` works online or off (V5B-64), survives a refresh
(V5B-61), and Back walks through the tabs (V5B-60).

---

## What's on each tab

**Progress**
1. **This week:** kept out of due, Monday to today, and a bar per day. Today's bar is so far. A
   day with nothing due is drawn as a *rest day* (a short dash), not an empty bar, because a
   Saturday off is not a Saturday failed. Days to come are a dashed outline. The bars grow in,
   except for anyone whose device asks for less motion.
2. **Highlights:** the longest streak going and whose it is, the best run ever, and check-ins in
   total. A run in weeks is compared as seven days a week, so three weeks of a twice-a-week habit
   outranks ten days of a daily one (V5B-18).
3. **History:** the review's four-week and year calendars, moved here and drawn in each habit's
   own colour from Block A.

**None of it is new arithmetic.** The week goes through `reviewDay`; the streaks go through
`habitStreak` and `bestEver`, the same functions behind Today's badges. So Progress can't
disagree with Today (V5B-17 in the rules, V5B-68 in a real browser).

**Settings:** Appearance (the theme as three rows instead of a popup) · Account & sync (the same
panel as the header button: sign in, sync state, the daily reminder, sign out, delete) · About
(version, where your habits are kept, privacy).

---

## What this block found

### A latent Windows-only test failure from before v5

`lib/contrast.test.ts` looks for markers like `":root {\n  --dark-surface"`. This repo converts
files to CRLF when checked out on Windows, and the first time `globals.css` came back through a
`git pull` here, the whole test file failed to load. CI checks out on Linux, which is why it had
always passed there. It now normalises line endings when it reads the CSS.

### The tab bar is a list, and one test counted every list item

V4C-50 checked that a resting habit sits below the due ones by taking "the last list item on the
page", which became the tab bar's **Settings** link. It now looks inside the habits' own list.
Nothing in the app was wrong.

### Two things I'm flagging rather than fixing

- **In dark mode, a full day's bar and a partial one are the same coral.** The dark palette's
  "all done" colour equals its accent. Bar height carries the meaning either way, and inventing a
  new colour to fix one chart isn't worth a palette change.
- **Without accounts, Settings is thin:** Appearance and About only. The plan predicted this.
  It's the state the live site is in until the Vercel setting is fixed, and padding it with
  invented settings would be worse than two honest sections.

---

## Results

### Rules: `lib/tab.test.ts`, `store/progress.test.ts`

| # | Check | |
|---|---|---|
| V5B-02 | no hash at all is Today, the page as it has always opened | ✅ |
| V5B-03 | **anything unknown is Today, never a blank screen** | ✅ 🔴 |
| V5B-10 | this week counts each day so far, Monday first, and leaves the rest empty | ✅ 🔴 |
| V5B-11 | **a day with nothing due is a rest day, not a zero** | ✅ 🔴 |
| V5B-12 | a habit kept on a day it wasn't due still counts | ✅ |
| V5B-13/14 | days before a habit existed, and archived or deleted habits, are left out | ✅ |
| V5B-16 | the longest streak going, and whose | ✅ |
| V5B-17 | **it is exactly the badge Today shows for that habit** | ✅ |
| V5B-18 | **a streak in weeks outranks a shorter one in days** | ✅ 🔴 |
| V5B-19 | no streaks at all is "none", not a habit with zero | ✅ 🔴 |
| V5B-21 | **check-ins: archived habits count; deleted habits, unticks and future-dated ticks don't** | ✅ 🔴 |

### Screens: `Screens.test.tsx`, `WeekCard.test.tsx`, `ThemeSetting.test.tsx`, `HabitHistory.test.tsx`

| # | Check | |
|---|---|---|
| V5B-50 | three tabs, in order, each a real link | ✅ |
| V5B-51 | Today is current with no hash, **announced as the current page** | ✅ 🔴 |
| V5B-52 | **a hash change shows that tab, and only that tab** | ✅ 🔴 |
| V5B-53 | **switching moves focus to the new screen's heading, and to the top** | ✅ 🔴 |
| V5B-54 | opening the page does not steal focus or scroll | ✅ 🔴 |
| V5B-56 | **a build with no accounts shows no account section, not a half-working one** | ✅ 🔴 |
| V5B-58 | privacy is one tap away from Settings | ✅ |
| V5B-59 | an empty Progress says what will fill it, rather than drawing empty charts | ✅ |
| V5B-41..46 | the week card: total in words, full/part/**rest**/future days drawn apart, motion off on request | ✅ 🔴 |
| V5B-30..32 | the theme rows: all three shown, current one chosen, picking applies and stores | ✅ |
| V5B-40 | the history is on Progress, with its dates | ✅ |

### Browser: `e2e/nav.spec.ts`, Android and desktop

| # | Check | |
|---|---|---|
| V5B-60 | **tapping a tab goes there, the address says so, and Back walks back** | ✅ |
| V5B-61 | **a refresh stays on the tab; a link straight to one opens it** | ✅ |
| V5B-62 | **moving between tabs never reloads the page** | ✅ 🔴 |
| V5B-63 | a new tab moves focus to its heading | ✅ |
| V5B-64 | **with no connection, a link to a tab still opens that tab** (the reason for hashes) | ✅ |
| V5B-65 | **the tab bar never sits on top of the last thing on a screen** | ✅ 🔴 |
| V5B-66 | **the undo bar appears above the tab bar** | ✅ 🔴 |
| V5B-67 | each tab is at least 44×44 | ✅ |
| V5B-68 | **Progress agrees with Today about the same habit** | ✅ |
| V5B-69 | the review and theme buttons have left the header | ✅ |

### The database suite, honestly

Block B changes no database, sync, SQL or test-support code, and the one shared file it touches
(`store/selectors.ts`) only gained functions. Not one existing line changed. Even so, the database
suite was not reliably green on this laptop. Across five runs, two were 107/107. The other three
each failed a **different** file: twice at setup with *"Local Supabase is not running"* while the
other eight files ran against the same containers, and once V3F-42, which passes when its file
runs alone. Each test file runs `npx supabase status` on its own, nine at once, on a 16 GB machine.

This is the Block A flake's bigger sibling. The task flagged in Block A is replaced by one that
covers both, with what's now known. GitHub's CI, which runs on Linux with nothing else competing,
is the arbiter for this PR.

### Mutation checks

16 killed, none survived. Every mutated file was checked byte-identical afterwards.

| # | Broke | Caught by |
|---|---|---|
| B1 | an unknown hash isn't sent to Today | V5B-03 |
| B2 | a rest day counted as due | V5B-11 |
| B3 | days still to come counted | V5B-10 |
| B4 | a streak in weeks compared as if it were days | V5B-18 |
| B5 | a zero streak shown as a standout | V5B-19 |
| B6 | deleted habits counted as check-ins | V5B-21 |
| B7 | ticks dated after today counted | V5B-21 |
| B8 | focus not moved to the new screen | V5B-53 |
| B9 | focus stolen on first load | V5B-54 |
| B10 | the current tab not announced | V5B-51 |
| B11 | the hash never listened to | V5B-52 |
| B12 | a rest day drawn as an empty bar | V5B-43 |
| B13 | the account section shown in a build with no accounts | V5B-56 |
| B14 | the page keeps its old bottom padding, so the last row hides under the bar | V5B-65 (browser) |
| B15 | the undo bar keeps its old offset, underneath the tab bar | V5B-66 (browser) |
| B16 | tabs that reload the page instead of being links | V5B-62 (browser) |

### Older tests whose meaning changed (not broken)

- **The review's tests** moved with it to the Progress tab. What it *shows* kept its IDs and
  assertions: V3C-22..25 (unit), V3C-50/52/53/55 (browser), V4C-55, V4D-50..53. Three tests
  were about the **sheet** itself and are retired: V3C-20 (opens from the header button), V3C-21
  and V3C-51 (Escape closes it and focus returns to the button). Their accessibility promise
  passes to V5B-53/V5B-63, which check that focus moves to each new screen's heading. V3C-54 now
  measures the range buttons, since the Close button it measured went with the sheet.
- **The theme's tests** moved to Settings. Every check about what a theme *does* (V2A-29..35,
  V3A-10, V3A-13) is unchanged; only the way in differs. V3A-05..08 were about opening, closing
  and returning focus to the old popup and are retired; V5B-30..32 cover the three rows.
- **V3G-05/20/22:** the privacy link is now in Settings → About.
- **V2A-37** measures the tab bar and the Settings rows as well. **V2A-39** (the console stays
  clean) now walks through every tab and reloads on one, since tabs drawn only in the browser
  are a new way to get a hydration warning.
- `offlineReady` moved from `offline.spec.ts` to the shared helpers, so the new offline tab test
  waits for the service worker the same proven way.

---

## Optional check, yours if you want it

On your Android phone, after the deploy:

1. Tap through the three tabs. Does it feel like an app rather than a web page?
2. On Progress, do the week bars and the calendars read at a glance?
3. Press the phone's Back button from Settings: you should land on the tab you came from.

Not marked passed on your behalf.

## Still owed from v4, unchanged by this block

The production build for v4 still fails on Vercel, so the live site is still the 21 September
bundle and neither v4 nor v5 is visible there yet. The build log names the missing setting.
