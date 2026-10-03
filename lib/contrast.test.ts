import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Accessibility regression guard for the palette.
 *
 * These read the real `app/globals.css` rather than a copy, so changing a colour
 * there is what this test is checking. Habibit shipped v0 with five pairs below
 * WCAG AA — the worst being placeholder text at 2.29:1 — and the point of this
 * file is that it cannot happen again quietly.
 */

/*
 * Line endings normalised: this repo converts to CRLF on a Windows checkout,
 * and the markers below are written with a bare newline. Without this the whole
 * file fails to load on Windows while passing on Linux CI — found in v5 Block
 * B, the first time globals.css came back through a pull on Windows.
 */
const CSS = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

/** Every `--name: value;` pair in a chunk of CSS. */
function readVars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[match[1]] = match[2].trim();
  }
  return out;
}

function blockAfter(marker: string): string {
  const start = CSS.indexOf(marker);
  if (start === -1) throw new Error(`Could not find "${marker}" in globals.css`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('\n}', open);
  return CSS.slice(open + 1, close);
}

const themeVars = readVars(blockAfter('@theme'));
const darkLiterals = readVars(blockAfter(':root {\n  --dark-surface'));

/** Resolves `var(--dark-x)` indirection down to a hex value. */
function hex(value: string): string {
  const indirect = value.match(/^var\((--[\w-]+)\)$/);
  const resolved = indirect ? darkLiterals[indirect[1]] : value;
  if (!/^#[0-9a-fA-F]{6}$/.test(resolved ?? '')) {
    throw new Error(`Not a 6-digit hex colour: ${value} -> ${resolved}`);
  }
  return resolved;
}

function relativeLuminance(colour: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(colour.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ---------------------------------------------------------------------------

describe('the two dark-mode rules cannot drift apart', () => {
  /*
   * Dark is declared twice — once media-gated for "the device asks for it", once
   * for "the user forced it". They cannot be merged into one selector, so this
   * asserts the two assignment lists stay identical.
   */
  const darkRules = [...CSS.matchAll(/\{([^{}]*)\}/g)]
    .map((m) => m[1])
    .filter((body) => body.includes('--color-surface:') && body.includes('var(--dark-'));

  it('there are exactly two of them', () => {
    expect(darkRules).toHaveLength(2);
  });

  it('they assign exactly the same variables to the same values', () => {
    expect(readVars(darkRules[0])).toEqual(readVars(darkRules[1]));
  });

  it('they cover every semantic role the light theme defines', () => {
    const semantic = Object.keys(themeVars).filter(
      (name) =>
        name.startsWith('--color-') &&
        !name.startsWith('--color-habibit-') &&
        name !== '--color-danger' &&
        name !== '--color-on-danger',
    );
    expect(Object.keys(readVars(darkRules[0])).sort()).toEqual(semantic.sort());
  });
});

// ---------------------------------------------------------------------------

const light = {
  surface: hex(themeVars['--color-surface']),
  card: hex(themeVars['--color-card']),
  ink: hex(themeVars['--color-ink']),
  inkSoft: hex(themeVars['--color-ink-soft']),
  accent: hex(themeVars['--color-accent']),
  onAccent: hex(themeVars['--color-on-accent']),
  badgeBg: hex(themeVars['--color-badge-bg']),
  badgeFg: hex(themeVars['--color-badge-fg']),
  doneBg: hex(themeVars['--color-badge-done-bg']),
  doneFg: hex(themeVars['--color-badge-done-fg']),
};

const dark = {
  surface: hex(darkLiterals['--dark-surface']),
  card: hex(darkLiterals['--dark-card']),
  ink: hex(darkLiterals['--dark-ink']),
  inkSoft: hex(darkLiterals['--dark-ink-soft']),
  accent: hex(darkLiterals['--dark-accent']),
  onAccent: hex(darkLiterals['--dark-on-accent']),
  badgeBg: hex(darkLiterals['--dark-badge-bg']),
  badgeFg: hex(darkLiterals['--dark-badge-fg']),
  doneBg: hex(darkLiterals['--dark-badge-done-bg']),
  doneFg: hex(darkLiterals['--dark-badge-done-fg']),
};

const danger = hex(themeVars['--color-danger']);
const onDanger = hex(themeVars['--color-on-danger']);

for (const [themeName, t] of [
  ['light', light],
  ['dark', dark],
] as const) {
  describe(`${themeName} theme meets WCAG AA`, () => {
    // 4.5:1 — normal-size body text.
    it.each([
      ['body text on the page', t.ink, t.surface],
      ['body text on a card', t.ink, t.card],
      ['secondary text on the page', t.inkSoft, t.surface],
      ['secondary text on a card', t.inkSoft, t.card],
      ['the progress badge', t.badgeFg, t.badgeBg],
      ['the all-done badge', t.doneFg, t.doneBg],
      // The Undo bar is the page's colours inverted. Its button deliberately uses
      // this pair too, not accent-on-ink, which measured 2.08:1 in dark mode.
      ['text on the undo bar', t.surface, t.ink],
      /*
       * v4 Block B: the how-often sheet. A chosen day shows a *letter*, not an
       * icon, so it needs 4.5:1 — and the accent pair used for the tick and the
       * + glyph is only 3.39:1 in light mode, which is fine for a shape and not
       * for text. It uses the all-done badge's pair instead, which is also what
       * "chosen" means everywhere else in the app.
       */
      ['a day chosen in the how-often sheet', t.doneFg, t.doneBg],
      ['a day not chosen there', t.ink, t.card],
    ])('%s reaches 4.5:1', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    // 3:1 — icons and control boundaries (WCAG 1.4.11 non-text contrast).
    it.each([
      ['the tick inside a checked circle', t.onAccent, t.accent],
      ['an unchecked circle outline', t.accent, t.card],
      ['the + glyph on the add button', t.onAccent, t.accent],
      ['the x delete icon', t.inkSoft, t.card],
    ])('%s reaches 3:1', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
    });
  });
}

/*
 * v5 Block A: the habit hues.
 *
 * Read from the CSS rather than listed here, so adding a seventh colour without
 * measuring it is caught by the test rather than by a user. Each hue draws the
 * ring and icon of an unchecked circle *and* the streak count beside the title,
 * and a count is text — so these are held to 4.5:1 against the card, not the
 * 3:1 an icon alone would need.
 */
const hueNames = Object.keys(themeVars)
  .filter((name) => name.startsWith('--color-hue-'))
  .map((name) => name.slice('--color-hue-'.length));

describe('the habit hues', () => {
  it('there are some, and dark has one of each', () => {
    expect(hueNames.length).toBeGreaterThanOrEqual(4);
    for (const name of hueNames) expect(darkLiterals[`--dark-hue-${name}`]).toBeDefined();
  });

  for (const [themeName, card, onHue] of [
    ['light', light.card, hex(themeVars['--color-on-hue'])],
    ['dark', dark.card, hex(darkLiterals['--dark-on-hue'])],
  ] as const) {
    describe(`${themeName} theme`, () => {
      it.each(hueNames.map((name) => [name]))(
        '%s reaches 4.5:1 against a card — it carries the streak count',
        (name) => {
          const value = themeName === 'light' ? themeVars[`--color-hue-${name}`] : darkLiterals[`--dark-hue-${name}`];
          expect(contrast(hex(value), card)).toBeGreaterThanOrEqual(4.5);
        },
      );

      it.each(hueNames.map((name) => [name]))('the tick on a chosen %s swatch reaches 3:1', (name) => {
        const value = themeName === 'light' ? themeVars[`--color-hue-${name}`] : darkLiterals[`--dark-hue-${name}`];
        expect(contrast(onHue, hex(value))).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

describe('the delete confirmation', () => {
  it('is legible in both themes, because it carries its own background', () => {
    expect(contrast(onDanger, danger)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the wordmark', () => {
  it('stays brand coral and is still legible on both grounds', () => {
    const brand = hex(themeVars['--color-habibit-500']);
    // Large text, so 3:1 is the bar.
    expect(contrast(brand, light.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(brand, dark.surface)).toBeGreaterThanOrEqual(3);
  });
});
