import { getStore } from './storage';

export const THEME_KEY = 'habibit:theme';

/** What the user chose. `system` means "follow the device". */
export type ThemePreference = 'light' | 'dark' | 'system';

/** What actually gets rendered once the preference is combined with the device. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_COLOURS: Record<ResolvedTheme, string> = {
  light: '#FFFBF7',
  dark: '#241726',
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Anything unrecognised means "follow the device", which is the default. */
export function loadThemePreference(): ThemePreference {
  const store = getStore();
  if (!store) return 'system';
  try {
    const raw = store.getItem(THEME_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  const store = getStore();
  if (!store) return;
  try {
    // `system` is the absence of a choice, so it is stored as the absence of a key.
    if (preference === 'system') store.removeItem(THEME_KEY);
    else store.setItem(THEME_KEY, preference);
  } catch {
    // A theme that will not persist is an annoyance, not a failure worth surfacing.
  }
}

/**
 * Keeps the status-bar colour honest.
 *
 * The layout ships two media-scoped `theme-color` metas. Those are exactly right
 * while the preference is `system`: the browser re-evaluates them itself when
 * the OS flips, with no JavaScript involved and no event to miss.
 *
 * They are wrong the moment the user overrides the device — forcing dark on a
 * light phone would leave a cream status bar above a plum app — so an explicit
 * choice replaces them with a single unconditional meta.
 *
 * Switching back to `system` restores the pair. An earlier version replaced them
 * unconditionally, which quietly broke OS tracking: the app followed the device
 * but the status bar kept whatever colour it had when you last tapped.
 */
function setThemeColourMeta(preference: ThemePreference): void {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());

  const add = (colour: string, media?: string) => {
    const meta = document.createElement('meta');
    // setAttribute rather than the IDL properties: `media` on <meta> is a recent
    // addition and is not reflected as a property everywhere.
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', colour);
    if (media) meta.setAttribute('media', media);
    document.head.appendChild(meta);
  };

  if (preference === 'system') {
    add(THEME_COLOURS.light, '(prefers-color-scheme: light)');
    add(THEME_COLOURS.dark, '(prefers-color-scheme: dark)');
    return;
  }

  add(THEME_COLOURS[preference]);
}

/** Writes the preference to the DOM. `system` removes the attribute entirely. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;

  setThemeColourMeta(preference);
}

/**
 * Runs before the first paint, inlined into the document.
 *
 * Without it, someone using dark mode gets a full white flash on every single
 * load, because React has not hydrated yet and the attribute is not set.
 * Deliberately tiny and dependency-free — it blocks rendering.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
