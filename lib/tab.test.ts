import { describe, expect, it } from 'vitest';
import { TABS, hrefForTab, tabFromHash } from './tab';

/* v5 Block B: which tab an address names. */

describe('V5B: reading the tab from the address', () => {
  it('V5B-01 · each tab’s own link names it', () => {
    for (const tab of TABS) expect(tabFromHash(hrefForTab(tab))).toBe(tab);
  });

  it('V5B-02 · ⭐ no hash at all is Today — the page as it has always opened', () => {
    expect(tabFromHash('')).toBe('today');
    expect(tabFromHash('#')).toBe('today');
  });

  it('V5B-03 · ⭐ anything unknown is Today, never a blank screen', () => {
    for (const hash of ['#review', '#progress/2025', '#settings?x=1', '#🙂', '#undefined']) {
      expect(tabFromHash(hash), hash).toBe('today');
    }
  });

  it('V5B-04 · case does not matter, and the # is optional', () => {
    expect(tabFromHash('#Progress')).toBe('progress');
    expect(tabFromHash('settings')).toBe('settings');
  });

  it('V5B-05 · Today is the first tab, so it is the leftmost in the bar', () => {
    expect(TABS[0]).toBe('today');
  });
});
