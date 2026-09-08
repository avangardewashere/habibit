# Habibit brand

**Name:** *habibi* (love) + *habit* + *bit* (small)
**Tagline:** Little habits. Lots of love.

## Icon

Source of truth: [`assets/habibit Icon.svg`](../assets/habibit%20Icon.svg) (512×512, provided by the user).
**This file is never edited.** Every shipped variant is derived from it by
[`scripts/generate-icons.mjs`](../scripts/generate-icons.mjs) — re-export from your design tool, drop it
in, run `npm run icons`, and all five outputs update together.

A pixel-art heart built out of rounded squares — the "bits" of the name — on a cream plate. Seven columns
by six rows, stepping 54px on a 45px tile with a 14px corner radius:

```
. X X . X X .
X X X X X X X
X X X X X X X
. X X X X X .
. . X X X . .
. . . X . . .
```

The heart is shaded top-to-bottom in three stops, which is where the palette below comes from.

### Generated variants

| Output | Size | Plate | Heart scale | Used for |
|---|---|---|---|---|
| `app/icon.svg` | vector | cream, `rx=128` | 1.0 | Browser tab favicon |
| `public/icons/icon-192.png` | 192 | cream, `rx=128` | 1.0 | Manifest, `purpose: any` |
| `public/icons/icon-512.png` | 512 | cream, `rx=128` | 1.0 | Manifest `any`, splash screen |
| `public/icons/icon-512-maskable.png` | 512 | cream, **`rx=0`** | **0.82** | Manifest, `purpose: maskable` |
| `app/apple-icon.png` | 180 | cream, **`rx=0`** | 1.0 | iOS home screen |

**Why two of them have square corners.** Android's maskable pipeline and iOS both apply their *own* shape
mask. Shipping pre-rounded corners into those slots gives a rounded square inside a rounded square, with a
visible cream sliver in the corners. `rx=128` is right only where the image is shown as-is — the browser
tab and the task switcher.

**Why the maskable heart is scaled to 0.82.** Android may crop a maskable icon to a circle of 80% diameter
— radius 204.8 on a 512 canvas. The heart's bounding box is 369×315, already perfectly centred on
(256, 256), which puts its widest corners about 211 from centre: just outside that circle. At scale 1.0 the
top corners would clip. 0.82 pulls the extremes to ~173 with room to spare.

**Legibility.** The mark reads clearly as a heart from about 24px up. At 16px (the browser tab favicon on a
non-retina screen) it reduces to a coral blob — which is true of most detailed marks at that size, and is
why the tab icon stays vector so it renders crisply wherever the display allows.

## Palette

The plate was originally dark plum `#241726`; it is now **cream**, so that the icon, the app background and
the phone's status bar are one continuous surface when Habibit is installed.

The palette is deliberately in two halves, and `app/globals.css` keeps them apart.

**Brand scale** — fixed identity, identical in both themes, matching the icon exactly:

| Token | Hex | Where |
|---|---|---|
| `habibit-400` | `#FF8189` | Top two rows of the heart; the accent in dark mode |
| `habibit-500` | `#F2545B` | Middle rows — the primary brand colour, and the wordmark in both themes |
| `habibit-600` | `#D93B4E` | Bottom rows of the heart |

**Semantic roles** — what the UI actually references, and what flips between themes:

| Role | Light | Dark |
|---|---|---|
| `surface` (page) | `#FFFBF7` cream | `#241726` plum |
| `card` | `#FFFFFF` | `#2E1F2A` |
| `ink` | `#2B2024` | `#F5EDEA` |
| `ink-soft` | `#7A6A72` | `#A2909A` |
| `line` | `#F3E7E4` | `#3A2A33` |
| `accent` / `on-accent` | `#F2545B` / `#FFFFFF` | `#FF8189` / `#241726` |
| `badge-bg` / `badge-fg` | `#FFF1F0` / `#AD2E3E` | `#3A2430` / `#FF8189` |
| `badge-done-bg` / `-fg` | `#C93247` / `#FFFFFF` | `#FF8189` / `#241726` |
| `danger` / `on-danger` | `#C93247` / `#FFFFFF` | same — a filled pill carries its own contrast |

Splitting them this way is what makes dark mode a variable swap rather than a component
rewrite: Tailwind v4 compiles utilities to `var(--color-*)`, so redefining the variables
re-themes everything with no component changes.

**Dark mode's ground is `#241726`** — the plum the icon's plate used to be, before it went
cream in Block 3. Nothing about the original design went to waste.

**Every pair above is asserted against WCAG AA by `lib/contrast.test.ts`**, which parses this
project's real stylesheet. v0 shipped with six pairs below AA — the worst being placeholder
text at 2.29:1 — and that test exists so it cannot happen quietly again.

**A known consequence of the cream plate.** The gradient was drawn against dark plum, where the *light* top
row carried the contrast. On cream that inverts — the bottom gains contrast and the top row goes softer. It
still reads as an intentional fade at full size. If it ever looks washed out, darkening `habibit-400` is a
one-line change in the source SVG.

**`ink-soft` changed in v0.5** from `#8A7A80` to `#7A6A72`. The original was 3.94:1 on cream, below the
4.5:1 WCAG AA needs for normal text. Secondary text is slightly darker now; the app should still read as
warm rather than stark.

## Colour reasoning

- **Coral, not red.** Red reads as *error*. Coral reads as *warmth*, which is the whole point of "habibi".
- **Cream (`#FFFBF7`), not white.** Pure white is what makes an interface feel clinical.
- **Warm near-black (`#2B2024`), not `#000`.** Same reason.

## Type

**Nunito** (via `next/font/google`). Rounded terminals carry "lots of love" without needing a single
decorative element, and they echo the icon's 14px-radius tiles.
