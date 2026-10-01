// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNDO_MS, UndoProvider, useUndo } from './UndoProvider';

/*
 * v4 Block A: the undo bar's timing.
 *
 * The provider is tested with a stand-in "delete" button rather than the real
 * sections, so these tests are about one thing: when the bar shows, how long
 * for, and what tapping it does.
 */

function Deleter({ name, onUndo }: { name: string; onUndo: () => void }) {
  const { offer } = useUndo();
  return (
    <button type="button" onClick={() => offer(`Deleted “${name}”`, onUndo)}>
      delete {name}
    </button>
  );
}

const bar = () => screen.queryByRole('status');
const undoButton = () => screen.getByRole('button', { name: 'Undo' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the undo bar', () => {
  it('V4A-30 · ⭐ appears after a delete, naming what was deleted', () => {
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={() => {}} />
      </UndoProvider>,
    );
    expect(bar()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));

    expect(bar()).toHaveTextContent('Deleted “Water”');
  });

  it('V4A-31 · ⭐ tapping Undo takes the delete back, and the bar goes', () => {
    const undo = vi.fn();
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={undo} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));

    fireEvent.click(undoButton());

    expect(undo).toHaveBeenCalledTimes(1);
    expect(bar()).toBeNull();
  });

  it('V4A-32 · ⭐ it goes by itself after six seconds, and nothing is undone', () => {
    const undo = vi.fn();
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={undo} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));

    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(bar()).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(bar()).toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });

  it('V4A-33 · ⭐ a second delete replaces the first bar instead of stacking', () => {
    const undoWater = vi.fn();
    const undoStretch = vi.fn();
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={undoWater} />
        <Deleter name="Stretch" onUndo={undoStretch} />
      </UndoProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete Stretch' }));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(bar()).toHaveTextContent('Deleted “Stretch”');
    fireEvent.click(undoButton());
    // Only the latest can be taken back; the first delete became final.
    expect(undoStretch).toHaveBeenCalledTimes(1);
    expect(undoWater).not.toHaveBeenCalled();
  });

  it('V4A-34 · ⭐ a replaced bar gets a fresh six seconds', () => {
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={() => {}} />
        <Deleter name="Stretch" onUndo={() => {}} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));
    act(() => vi.advanceTimersByTime(UNDO_MS - 1000));

    fireEvent.click(screen.getByRole('button', { name: 'delete Stretch' }));
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));

    expect(bar()).toHaveTextContent('Deleted “Stretch”');
  });

  it('V4A-35 · ⭐ it does not vanish while it has keyboard focus', () => {
    // Six seconds is fine to glance at and hopeless to reach by keyboard or
    // screen reader if it can disappear on the way.
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={() => {}} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));

    fireEvent.focus(undoButton());
    act(() => vi.advanceTimersByTime(UNDO_MS * 5));
    expect(bar()).not.toBeNull();

    // Let go, and it counts down again, in full.
    fireEvent.blur(undoButton());
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(bar()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(bar()).toBeNull();
  });

  it('V4A-36 · it does not vanish while the pointer is over it', () => {
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={() => {}} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));

    fireEvent.pointerEnter(bar()!);
    act(() => vi.advanceTimersByTime(UNDO_MS * 5));
    expect(bar()).not.toBeNull();
  });

  it('V4A-37 · the Undo button is comfortable to tap', () => {
    render(
      <UndoProvider>
        <Deleter name="Water" onUndo={() => {}} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete Water' }));

    expect(undoButton().className).toContain('min-h-11');
  });
});
