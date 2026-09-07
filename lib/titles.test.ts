import { describe, expect, it } from 'vitest';
import { toTitles } from './titles';

describe('toTitles', () => {
  it('returns a single trimmed title for ordinary input', () => {
    expect(toTitles('  Drink water  ')).toEqual(['Drink water']);
  });

  it('splits a pasted list into one title per line', () => {
    expect(toTitles('Meditate\nWalk outside\nJournal')).toEqual([
      'Meditate',
      'Walk outside',
      'Journal',
    ]);
  });

  it('drops blank lines and trims each line', () => {
    expect(toTitles('Meditate\n\n   Walk outside  \nJournal\n')).toEqual([
      'Meditate',
      'Walk outside',
      'Journal',
    ]);
  });

  it('handles Windows line endings, which is what a paste from Notepad gives', () => {
    expect(toTitles('Meditate\r\nJournal')).toEqual(['Meditate', 'Journal']);
  });

  it('returns nothing for empty or whitespace-only input', () => {
    expect(toTitles('')).toEqual([]);
    expect(toTitles('   ')).toEqual([]);
    expect(toTitles('\n\n  \n')).toEqual([]);
  });
});
