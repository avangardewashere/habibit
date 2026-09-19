/**
 * Sort keys for a list you can rearrange, where moving one item changes only
 * that item.
 *
 * With positions 1, 2, 3…, moving the last habit to the top renumbers every
 * habit. Two devices reordering at once would then fight over every row, and
 * "latest change wins" (decided per habit) would stitch their two orders
 * together into something neither of them chose.
 *
 * Instead each position is a string, sorted as text, and a new position can
 * always be made *between* any two others: between "a" and "b" there is "aV".
 * So a move writes one new key for the moved habit and leaves the rest alone.
 *
 * A key reads like the digits after a decimal point, in base 62. Keys never end
 * in "0" (just as 0.50 is really 0.5), which guarantees there is always room
 * below any key.
 *
 * Keys are compared with `<`, character code by character code, never with
 * `localeCompare`: a locale-aware comparison would order "a" and "B" differently
 * on different devices. For the same reason any SQL that sorts by these must
 * use `COLLATE "C"`.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Past this length the whole list is given fresh, short keys (see `evenKeys`). */
export const LONGEST_KEY = 64;

const KEY_PATTERN = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

/** A well-formed key. Anything else from storage or the server is treated as "no position". */
export function isOrderKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= LONGEST_KEY * 4 && KEY_PATTERN.test(value);
}

/**
 * A key that sorts strictly after `before` and strictly before `after`.
 * `null` means that end is open: `keyBetween(null, null)` is the first key of an
 * empty list, `keyBetween(last, null)` goes at the end.
 */
export function keyBetween(before: string | null, after: string | null): string {
  if (before !== null && !isOrderKey(before)) throw new Error(`Not an order key: ${before}`);
  if (after !== null && !isOrderKey(after)) throw new Error(`Not an order key: ${after}`);
  if (before !== null && after !== null && before >= after) {
    throw new Error(`Keys out of order: ${before} >= ${after}`);
  }
  return midpoint(before ?? '', after);
}

function midpoint(a: string, b: string | null): string {
  // Skip the digits both share: the answer shares them too.
  if (b !== null) {
    let shared = 0;
    while ((a[shared] ?? '0') === b[shared]) shared += 1;
    if (shared > 0) return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared));
  }

  const low = a ? DIGITS.indexOf(a[0]) : 0;
  const high = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;

  // Room for a digit in between: take the middle one, and stop there.
  if (high - low > 1) return DIGITS[Math.round((low + high) / 2)];

  // Neighbouring digits. If `b` goes on past its first digit, that digit alone
  // already sorts below `b` and at or above `a`'s start.
  if (b !== null && b.length > 1) return b[0];

  // Otherwise keep `a`'s digit and find room one place further along.
  return DIGITS[low] + midpoint(a.slice(1), null);
}

/**
 * `count` short keys in ascending order, spread evenly with room between each,
 * for giving a whole list fresh positions at once.
 *
 * Each key is a fixed-width number in base 62, with just enough digits that
 * every key gets its own value: two digits (62² = 3844 values) covers any real
 * list of habits.
 */
export function evenKeys(count: number): string[] {
  const base = DIGITS.length;
  let width = 1;
  while (base ** width <= count + 1) width += 1;
  const space = base ** width;

  return Array.from({ length: count }, (_, i) => {
    // Strictly increasing and never 0, because the step space / (count + 1) is above 1.
    let value = Math.round(((i + 1) * space) / (count + 1));
    let key = '';
    for (let place = 0; place < width; place += 1) {
      key = DIGITS[value % base] + key;
      value = Math.floor(value / base);
    }
    // "X0" and "X" are the same position, and keys never end in 0.
    return key.replace(/0+$/, '');
  });
}
