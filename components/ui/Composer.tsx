'use client';

import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ClipboardEvent, FormEvent } from 'react';
import { toTitles } from '@/lib/titles';

/**
 * The add field, shared by habits and tasks.
 *
 * A single-line input keeps the common case (type one thing, hit enter) as
 * light as possible on a phone. Adding several at once is handled on paste:
 * paste a multi-line list and every line becomes its own item. That covers
 * "add multiple at a time" without making the everyday case a textarea.
 */
export function Composer({
  placeholder,
  addLabel,
  onAdd,
}: {
  placeholder: string;
  addLabel: string;
  onAdd: (titles: string[]) => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const titles = toTitles(value);
    if (titles.length === 0) return;
    onAdd(titles);
    setValue('');
    inputRef.current?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (!text.includes('\n')) return; // ordinary paste, let the browser do it

    event.preventDefault();
    const titles = toTitles(text);
    if (titles.length === 0) return;
    onAdd(titles);
    setValue('');
  }

  const canSubmit = value.trim().length > 0;

  return (
    <form onSubmit={submit} className="flex items-center gap-1 border-t border-line pr-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        enterKeyHint="done"
        /* text-base is 16px: below that, iOS Safari zooms on focus and never zooms back. */
        className="min-h-14 flex-1 bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink-soft/70"
      />
      <button
        type="submit"
        disabled={!canSubmit}
        aria-label={addLabel}
        className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full bg-habibit-500 text-white transition active:scale-90 disabled:bg-line disabled:text-ink-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-habibit-500"
      >
        <Plus className="h-5 w-5" strokeWidth={3} />
      </button>
    </form>
  );
}
