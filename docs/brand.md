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

| Role | Hex | Where |
|---|---|---|
| `habibit-400` | `#FF8189` | Top two rows of the heart |
| `habibit-500` | `#F2545B` | Middle rows — the primary brand colour |
| `habibit-600` | `#D93B4E` | Bottom rows; pressed and active states in the UI |
| `cream` | `#FFFBF7` | Icon plate, page background, `theme_color`, `background_color` |
| `ink` | `#2B2024` | Body text |
| `ink-soft` | `#8A7A80` | Secondary text |

The `--color-habibit-*` tokens in `app/globals.css` are these exact values, so the UI and the home-screen
icon are the same coral rather than two coincidentally similar ones.

**A known consequence of the cream plate.** The gradient was drawn against dark plum, where the *light* top
row carried the contrast. On cream that inverts — the bottom gains contrast and the top row goes softer. It
still reads as an intentional fade at full size. If it ever looks washed out, darkening `habibit-400` is a
one-line change in the source SVG.

## Colour reasoning

- **Coral, not red.** Red reads as *error*. Coral reads as *warmth*, which is the whole point of "habibi".
- **Cream (`#FFFBF7`), not white.** Pure white is what makes an interface feel clinical.
- **Warm near-black (`#2B2024`), not `#000`.** Same reason.

## Type

**Nunito** (via `next/font/google`). Rounded terminals carry "lots of love" without needing a single
decorative element, and they echo the icon's 14px-radius tiles.
