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
 * The link from Supabase's *default* email, used until custom email templates
 * are available (the hosted project only allows editing them once a custom
 * email sender is set up).
 *
 * That link goes through Supabase first, which then redirects here with the
 * session — or the reason it failed — after the `#`:
 *   #access_token=…&refresh_token=…&type=magiclink
 *   #error=access_denied&error_code=otp_expired&error_description=…
 * Like `token_hash`, it works in whichever browser opens it.
 */
export async function signInFromLinkFragment(fragment: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return OFF;

  const values = new URLSearchParams(fragment.replace(/^#/, ''));

  if (values.get('error_code') === 'otp_expired') {
    return { ok: false, message: 'That code or link has expired or was already used. Ask for a new one.' };
  }
  if (values.has('error') || values.has('error_code')) {
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }

  const access_token = values.get('access_token');
  const refresh_token = values.get('refresh_token');
  if (!access_token || !refresh_token) {
    return { ok: false, message: 'This sign-in link is incomplete. Ask for a new one from the app.' };
  }

  // Checks the token with the server before storing it, so a forged fragment
  // can't sign anyone in.
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
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

/**
 * Deletes the account and everything synced to it, then signs this device out.
 *
 * The database decides whose account goes — `delete_my_account()` takes no
 * arguments and reads the caller's own id from their token, so nothing here can
 * name someone else (supabase/migrations/20260923000000_delete_account.sql).
 *
 * Signing out afterwards is not a tidy-up: the token in this browser keeps
 * working until it expires, so leaving it in place would mean an app that looks
 * signed in to an account that no longer exists. It is done even if the sign-out
 * itself fails, because by then the account really is gone and saying otherwise
 * would be a lie.
 *
 * **What it does not touch is the copy on this device.** Your habits are still
 * here, and the app still works, signed out, exactly as it did before you ever
 * made an account.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return OFF;

  try {
    const { data, error } = await supabase.rpc('delete_my_account');
    if (error) {
      return error.message === 'Failed to fetch'
        ? { ok: false, message: 'Couldn’t reach the server. Check your connection and try again.' }
        : { ok: false, message: 'Couldn’t delete your account. Please try again.' };
    }
    // `false` means the database had nobody to delete: this browser's token is
    // stale. Signing out is exactly the right thing to do with it.
    if (data !== true) {
      await forgetToken(supabase);
      return { ok: false, message: 'You’re not signed in on this device any more.' };
    }
  } catch {
    return { ok: false, message: 'Couldn’t reach the server. Check your connection and try again.' };
  }

  await forgetToken(supabase);
  return OK;
}

/**
 * Drops this browser's token, and never fails doing it.
 *
 * By the time this is called the account is already gone, so there is nothing
 * left for an error to protect — and a rejection here would escape into
 * whatever effect called it and show nothing at all (the shape of the bug CI
 * found in Block D).
 */
async function forgetToken(supabase: NonNullable<ReturnType<typeof getSupabase>>): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Nothing to do and nobody to tell: the account is gone either way.
  }
}
