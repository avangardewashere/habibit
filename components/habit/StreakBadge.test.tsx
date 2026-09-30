// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StreakBadge } from './StreakBadge';

/*
 * v4 Block C: the badge has to say what it is counting.
 *
 * A habit kept three times a week has a run measured in weeks. A bare "3"
 * beside a flame reads as three days, which would be a lie — and a flattering
 * one, which is worse.
 */

describe('the streak badge', () => {
  it('V4C-40 · says nothing at all at zero', () => {
    const { container } = render(<StreakBadge streak={{ count: 0, unit: 'day' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('V4C-41 · ⭐ counts days in days', () => {
    render(<StreakBadge streak={{ count: 5, unit: 'day' }} />);
    expect(screen.getByLabelText('5 days in a row')).toHaveTextContent('5');
    expect(screen.getByLabelText('5 days in a row')).not.toHaveTextContent('w');
  });

  it('V4C-42 · ⭐ and weeks in weeks, on screen as well as to a screen reader', () => {
    render(<StreakBadge streak={{ count: 3, unit: 'week' }} />);
    expect(screen.getByLabelText('3 weeks in a row')).toHaveTextContent('3w');
  });

  it('V4C-43 · one of either reads as singular', () => {
    const { rerender } = render(<StreakBadge streak={{ count: 1, unit: 'day' }} />);
    expect(screen.getByLabelText('1 day in a row')).toBeVisible();

    rerender(<StreakBadge streak={{ count: 1, unit: 'week' }} />);
    expect(screen.getByLabelText('1 week in a row')).toBeVisible();
  });
});
