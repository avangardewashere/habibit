'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Open/close state for a small popup anchored to a button: closes on Escape and
 * on a tap outside, and hands focus back to the button when closed by keyboard.
 *
 * Only behaviour, no markup, so any popup can reuse it: the account menu and the
 * theme menu both do.
 */
export function usePopover<Anchor extends HTMLElement, Wrapper extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<Anchor>(null);
  const wrapperRef = useRef<Wrapper>(null);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) anchorRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close(true);
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return {
    open,
    toggle: () => setOpen((value) => !value),
    close,
    anchorRef,
    wrapperRef,
  };
}
