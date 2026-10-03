'use client';

import { useSyncExternalStore } from 'react';
import { tabFromHash, type Tab } from './tab';

/*
 * The current tab, read from the address.
 *
 * The tabs are plain links (`<a href="#progress">`), so the browser does the
 * real work: it puts the hash in history, takes it out on Back, and fires
 * `hashchange` either way. This only listens.
 *
 * The server cannot see a hash at all — it is never sent — so the server always
 * renders Today, and the client moves to the named tab as soon as it hydrates.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const fromAddress = (): Tab => tabFromHash(window.location.hash);
const onServer = (): Tab => 'today';

export function useTab(): Tab {
  return useSyncExternalStore(subscribe, fromAddress, onServer);
}
