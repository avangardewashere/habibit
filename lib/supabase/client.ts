import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
 * Both values are public by design: the URL says where the project is, and the
 * publishable key only lets the browser *ask*. What any request may actually
 * read or change is decided by Row Level Security in the database
 * (supabase/migrations). The secret key never goes anywhere near this file.
 *
 * Written out in full, not read through a variable, because Next only inlines
 * `process.env.NEXT_PUBLIC_*` into the browser bundle when it sees the literal.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * The one browser client, or `null` on the server or when accounts are off.
 *
 * Accounts are optional twice over: a person can use Habibit signed out, and a
 * build with no Supabase settings (a fork, a preview) gets `null` here and so
 * has no account button. Everything else works exactly as before.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined' || !url || !publishableKey) return null;

  client ??= createClient(url, publishableKey, {
    auth: {
      // The session lives in localStorage beside the habits, under our own name.
      storageKey: 'habibit:auth',
      persistSession: true,
      autoRefreshToken: true,
      // /auth/confirm handles sign-in links itself, so the client must not also
      // try to read tokens out of every URL.
      detectSessionInUrl: false,
    },
  });
  return client;
}
