// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemRow } from './ItemRow';

/**
 * Interaction tests for the row's `⋯` menu and inline rename.
 *
 * These exist because this row has already shipped one focus-ordering bug:
 * in v0.5 a blur handler fired before the row's click, so cancelling a delete
 * ticked the habit instead. Rename adds more blur-sensitive paths (blur-to-save,
 * Escape-to-cancel, the ✓ button), so each one is pinned here.
 */

function setup(overrides: Partial<Parameters<typeof ItemRow>[0]> = {}) {
  const props = {
    title: 'Drink water',
    checked: false,
    onToggle: vi.fn(),
    onRemove: vi.fn(),
    onRename: vi.fn(),
    actionsLabel: 'More actions for Drink water',
    renameLabel: 'Rename habit: Drink water',
    deleteLabel: 'Delete Drink water and its whole completion history',
    ...overrides,
  };
  render(
    <ul>
      <ItemRow {...props} />
    </ul>,
  );
  return props;
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
const startRename = () => {
  openMenu();
  fireEvent.click(screen.getByRole('button', { name: /^rename habit/i }));
  return screen.getByRole('textbox', { name: /rename habit/i }) as HTMLInputElement;
};

afterEach(() => vi.useRealTimers());

describe('the ⋯ menu', () => {
  it('opens Rename and Delete in place of the ⋯ button', () => {
    setup();
    openMenu();

    expect(screen.getByRole('button', { name: /^rename habit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete drink water/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
  });

  it('closes when the row is tapped, WITHOUT ticking the item', () => {
    const props = setup();
    openMenu();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
  });

  it('still toggles normally once closed', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('deletes only from inside the menu — two taps, never one', () => {
    const props = setup();
    expect(screen.queryByRole('button', { name: /^delete/i })).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /^delete drink water/i }));

    expect(props.onRemove).toHaveBeenCalledTimes(1);
  });

  it('closes on its own after a few seconds', () => {
    vi.useFakeTimers();
    setup();
    openMenu();

    act(() => {
      vi.advanceTimersByTime(4100);
    });

    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
  });

  it('hides the trailing slot while open, to make room for the two buttons', () => {
    setup({ trailing: <span>streak-badge</span> });
    expect(screen.getByText('streak-badge')).toBeInTheDocument();

    openMenu();
    expect(screen.queryByText('streak-badge')).not.toBeInTheDocument();
  });
});

describe('renaming', () => {
  it('shows an input pre-filled with the current title', () => {
    setup();
    const input = startRename();
    expect(input.value).toBe('Drink water');
  });

  it('saves on Enter, exactly once', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Drink more water' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // A blur arriving after the input has gone must not save a second time.
    fireEvent.blur(input);

    expect(props.onRename).toHaveBeenCalledTimes(1);
    expect(props.onRename).toHaveBeenCalledWith('Drink more water');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('saves when focus leaves the input', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Drink more water' } });
    fireEvent.blur(input);

    expect(props.onRename).toHaveBeenCalledWith('Drink more water');
  });

  it('saves from the ✓ button, exactly once', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Drink more water' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(props.onRename).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape, and a blur on the way out does NOT save', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Something else' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Drink water')).toBeInTheDocument();
  });

  it('does not let a cancelled session swallow the NEXT session’s blur-to-save', () => {
    // Regression guard for a bug caught before shipping: Escape arms a
    // "skip the next blur" flag. If no blur arrives on unmount, that flag used
    // to survive into the next rename and silently discard its save.
    const props = setup();

    const first = startRename();
    fireEvent.keyDown(first, { key: 'Escape' }); // no blur follows

    const second = startRename();
    fireEvent.change(second, { target: { value: 'Drink more water' } });
    fireEvent.blur(second);

    expect(props.onRename).toHaveBeenCalledWith('Drink more water');
  });

  it('ignores Enter while a word is still being composed', () => {
    // Predictive keyboards and CJK input use Enter to confirm the word in
    // progress. That must not save a half-typed name.
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Drink more wat' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    // Once composition ends, Enter saves as normal. (Must differ from the
    // original title, or the unchanged-title check rightly skips the save.)
    fireEvent.change(input, { target: { value: 'Drink more water' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('Drink more water');
  });

  it('does not save a blank title', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Drink water')).toBeInTheDocument();
  });

  it('does not dispatch when the title is unchanged', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: '  Drink water  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('never toggles the item while renaming', () => {
    const props = setup();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Drink more water' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it('keeps the strip visible while editing', () => {
    setup({ below: <div>day-strip</div> });
    startRename();
    expect(screen.getByText('day-strip')).toBeInTheDocument();
  });
});
