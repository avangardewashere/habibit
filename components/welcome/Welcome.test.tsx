// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleState } from '@/lib/sample';
import { STORAGE_KEY } from '@/lib/storage';
import { HabibitProvider, useHabibit } from '@/store/HabibitProvider';
import { UndoProvider } from '@/store/UndoProvider';
import { SampleBanner } from './SampleBanner';
import { STARTERS, Welcome } from './Welcome';

/*
 * v5 Block C: what an empty Habibit opens on, and the banner that says the
 * sample is made up.
 */

describe('the welcome', () => {
  it('V5C-40 · ⭐ offers the sample, and says so in words', () => {
    const onSample = vi.fn();
    render(<Welcome canSample onSample={onSample} onStart={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'See it with sample habits' }));
    expect(onSample).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Small habits, kept daily.' })).toBeInTheDocument();
  });

  it('V5C-41 · ⭐ signed in, the sample is not offered at all', () => {
    // It would be cleared the moment it arrived: offering it would be a trick.
    render(<Welcome canSample={false} onSample={() => {}} onStart={() => {}} />);
    expect(screen.queryByRole('button', { name: /sample/ })).not.toBeInTheDocument();
    expect(screen.getByText('Start with one of these')).toBeInTheDocument();
  });

  it('V5C-42 · ⭐ each starter adds exactly that habit', () => {
    const onStart = vi.fn();
    render(<Welcome canSample onSample={() => {}} onStart={onStart} />);
    for (const title of STARTERS) fireEvent.click(screen.getByRole('button', { name: `Add ${title}` }));
    expect(onStart.mock.calls.map(([title]) => title)).toEqual([...STARTERS]);
  });

  it('V5C-43 · the picture is decoration, hidden from a screen reader', () => {
    const { container } = render(<Welcome canSample onSample={() => {}} onStart={() => {}} />);
    const picture = container.querySelector('[aria-hidden]')!;
    expect(picture.querySelectorAll('svg').length).toBeGreaterThanOrEqual(4);
  });

  it('V5C-44 · the faces only bob for someone who hasn’t asked for less motion', () => {
    const { container } = render(<Welcome canSample onSample={() => {}} onStart={() => {}} />);
    for (const face of container.querySelectorAll('[aria-hidden] > span')) {
      expect(face.className).toMatch(/motion-safe:animate-float/);
      expect(face.className).not.toMatch(/(^|\s)animate-float/);
    }
  });
});

describe('the sample banner', () => {
  let api: ReturnType<typeof useHabibit>;
  function Probe() {
    api = useHabibit();
    return null;
  }
  function show() {
    render(
      <HabibitProvider>
        <UndoProvider>
          <SampleBanner />
          <Probe />
        </UndoProvider>
      </HabibitProvider>,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-07T09:00:00+08:00'));
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('V5C-45 · ⭐ is there while the sample is, and says it is made up', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state: sampleState('2026-10-07') }));
    show();
    const banner = screen.getByRole('complementary', { name: 'Sample habits' });
    expect(banner).toHaveTextContent('Made up, to show what Habibit does.');
  });

  it('V5C-46 · is not there for your own habits', () => {
    show();
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Mine' }));
    expect(screen.queryByRole('complementary', { name: 'Sample habits' })).not.toBeInTheDocument();
  });

  it('V5C-47 · ⭐ clears the sample in one tap, and that can be undone', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state: sampleState('2026-10-07') }));
    show();

    fireEvent.click(within(screen.getByRole('complementary', { name: 'Sample habits' })).getByRole('button', { name: 'Clear them' }));
    expect(api.state.habits).toHaveLength(0);
    expect(screen.queryByRole('complementary', { name: 'Sample habits' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(api.state.habits).toHaveLength(6);
  });
});
