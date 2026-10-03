// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckCircle } from './CheckCircle';

/*
 * v5 Block A: what the circle draws inside itself.
 *
 * The bug this guards was found in a real browser (V5A-74): a task's unchecked
 * circle holds a tick drawn in transparent ink, and a habit's unchecked circle
 * is inked in the habit's colour — so a habit with no icon showed a coloured
 * tick, and looked done when it wasn't.
 */

const svgs = (ui: React.ReactElement) => render(ui).container.querySelectorAll('svg');

describe('the check circle', () => {
  it('V5A-80 · ⭐ an unchecked habit with no icon draws nothing inside — not a tick', () => {
    expect(svgs(<CheckCircle checked={false} colour="teal" />)).toHaveLength(0);
  });

  it('V5A-81 · an unchecked habit with an icon draws the icon', () => {
    const found = svgs(<CheckCircle checked={false} colour="teal" glyph={<svg data-testid="icon" />} />);
    expect(found).toHaveLength(1);
    expect(found[0].dataset.testid).toBe('icon');
  });

  it('V5A-82 · a checked habit draws the tick, whatever its icon', () => {
    const found = svgs(<CheckCircle checked colour="teal" glyph={<svg data-testid="icon" />} />);
    expect(found).toHaveLength(1);
    expect(found[0].dataset.testid).toBeUndefined();
  });

  it('V5A-83 · a task is exactly as before: the tick is there, in transparent ink, until ticked', () => {
    const { container } = render(<CheckCircle checked={false} />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.firstElementChild!.className).toContain('text-transparent');
  });
});
