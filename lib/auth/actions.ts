import type { AuthError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Every account action returns a plain result instead of throwing, with an
 * error already worded for a person rather than a developer.
 */
export type AuthResult = { ok: true } | { ok: false; message: string };

const OK: AuthResult = { ok: true };
const OFF: AuthResult = { ok: false, message: 'Accounts are not available right now.' };

function friendly(error: AuthError | Error): AuthResult {
  const status = 'status' in error ? error.status : undefined;
  const code = 'code' in error ? error.code : undefined;

  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return { ok: false, message: 'Too many attempts. Wait a minute, then try again.' };
  }
  if (code === 'otp_expired' || status === 403) {
    return { ok: false, message: 'That code or link has expired or was already used. Ask for a new one.' };
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return { ok: false, message: 'That email address doesn’t look right.' };
  }
  if (error.name === 'AuthRetryableFetchError' || error.message === 'Failed to fetch') {
    return { ok: false, message: 'Couldn’t reach the server. Check your connection and try again.' };
  }
  return { ok: false, message: 'Something went wrong. Please try again.' };
}

/** Deliberately loose: the server does the real check. This only catches typos. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Emails a sign-in code and link. Also creates the account the first time, so
 * there is no separate "sign up".
 */
export async function requestSignIn(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return OFF;

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      // Where the email's link sends people. Must be on the project's allow-list.
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
    },
  });
  return error ? friendly(error) : OK;
}

/** The code typed into the app. */
export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return OFF;

  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.replace(/\s/g, ''),
    type: 'email',
  });
  return error ? friendly(error) : OK;
}

/**
 * The link from the email. It carries a one-time `token_hash`, which works in
 * whichever browser opens it — unlike a PKCE link, which only works in the
 * browser that asked for it.
 */
export async function verifyLink(tokenHash: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return OFF;

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  return error ? friendly(error) : OK;
}

/**
 * Signs out *this device only*. Other devices stay signed in.
 *
 * Nothing on the device is deleted: in this block the account holds no data
 * yet, so the habits here are still the only copy. What sign-out should do with
 * local data once sync exists is decided in Block D.
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return OFF;

  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? friendly(error) : OK;
}
