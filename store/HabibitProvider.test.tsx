// @vitest-environment jsdom
import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import realV1 from '@/lib/fixtures/storage-v1.json';
import { SCHEMA_VERSION, STORAGE_KEY } from '@/lib/storage';
import type { HabibitState } from '@/lib/types';
import { HabibitProvider, useHabibit } from './HabibitProvider';

/**
 * Regression tests for the bug that shipped in v0.5 Block A: reloading wiped
 * everything.
 *
 * The provider originally guarded its save effect with a "have we hydrated yet"
 * ref. That is not enough. The save effect belonging to the *first* render
 * closes over the empty `initialState`, and can still run after the flag has
 * been set — StrictMode does this every time. It then wrote the empty state
 * over the user's real data.
 *
 * These render under <StrictMode> precisely because that is what makes the race
 * deterministic. No pure-function test could have caught this.
 */

const stored: HabibitState = {
  habits: [
    {
      id: 'h1',
      title: 'Drink water',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
      archivedAt: null,
      deletedAt: null,
    },
  ],
  tasks: [
    {
      id: 't1',
      title: 'Book dentist',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
      completedAt: null,
      deletedAt: null,
    },
  ],
  completions: { 'h1::2026-09-08': { done: true, updatedAt: '2026-09-08T01:00:00.000Z' } },
};

function Probe() {
  const { state, dispatch } = useHabibit();
  return (
    <div>
      <span data-testid="habits">{state.habits.map((h) => h.title).join(',')}</span>
      <span data-testid="tasks">{state.tasks.map((t) => t.title).join(',')}</span>
      <span data-testid="completions">{Object.keys(state.completions).join(',')}</span>
      <button type="button" onClick={() => dispatch({ type: 'ADD_HABIT', title: 'Stretch' })}>
        add
      </button>
    </div>
  );
}

function readStorage(): HabibitState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw).state : null;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('hydrating from storage under StrictMode', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, state: stored }),
    );
  });

  it('shows the stored data', async () => {
    render(
      <StrictMode>
        <HabibitProvider>
          <Probe />
        </HabibitProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent('Drink water'));
    expect(screen.getByTestId('tasks')).toHaveTextContent('Book dentist');
    expect(screen.getByTestId('completions')).toHaveTextContent('h1::2026-09-08');
  });

  it('does NOT overwrite storage with the empty initial state', async () => {
    render(
      <StrictMode>
        <HabibitProvider>
          <Probe />
        </HabibitProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent('Drink water'));

    // The actual regression: this used to come back as { habits: [], ... }.
    expect(readStorage()).toEqual(stored);
  });

  it('leaves the stored bytes untouched when nothing is edited', async () => {
    const before = window.localStorage.getItem(STORAGE_KEY);

    render(
      <StrictMode>
        <HabibitProvider>
          <Probe />
        </HabibitProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent('Drink water'));

    // Hydrating is a read. It must not trigger a write back, which in the
    // multi-tab case would notify the other tab and start a write/notify loop.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
});

describe('upgrading v1 data under StrictMode', () => {
  const RAW_V1 = JSON.stringify(realV1);

  beforeEach(() => window.localStorage.setItem(STORAGE_KEY, RAW_V1));

  function renderApp() {
    render(
      <StrictMode>
        <HabibitProvider>
          <Probe />
        </HabibitProvider>
      </StrictMode>,
    );
  }

  it('shows the upgraded data', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('habits')).toHaveTextContent('Drink water,Stretch,Read 20 pages'),
    );
    expect(screen.getByTestId('tasks')).toHaveTextContent('Call mum,Book dentist');
  });

  it('⭐ leaves the v1 bytes untouched until something is edited', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent('Drink water'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(RAW_V1);
  });

  it('the first edit saves everything as version 2, with nothing lost', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent('Drink water'));

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).version).toBe(2));
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).state;
    expect(saved.habits.map((h: { title: string }) => h.title)).toEqual([
      'Drink water',
      'Stretch',
      'Read 20 pages',
      'Stretch',
    ]);
    expect(Object.keys(saved.completions)).toHaveLength(Object.keys(realV1.state.completions).length);
  });

  it('StrictMode running the reducer twice still adds exactly one habit with one id', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent('Drink water'));

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).version).toBe(2));
    const ids = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).state.habits.map((h: { id: string }) => h.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('starting with nothing stored', () => {
  it('renders empty and does not write anything', async () => {
    render(
      <StrictMode>
        <HabibitProvider>
          <Probe />
        </HabibitProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId('habits')).toHaveTextContent(''));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('unreadable storage', () => {
  it('falls back to empty without crashing, and keeps the bad value', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{{{ not json');

    render(
      <StrictMode>
        <HabibitProvider>
          <Probe />
        </HabibitProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId('habits')).toBeInTheDocument());
    expect(screen.getByTestId('habits')).toHaveTextContent('');
    expect(window.localStorage.getItem('habibit:state:corrupt')).toBe('{{{ not json');
  });
});
