/**
 * Splits typed or pasted text into clean item titles, one per line.
 *
 * This is what turns a pasted list into several habits at once, so it is worth
 * keeping pure and tested rather than buried in a component.
 */
export function toTitles(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
