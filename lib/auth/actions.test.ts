// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => ({ auth: { setSession } }) }));

import { signInFromLinkFragment } from './actions';

beforeEach(() => setSession.mockReset());

describe("reading Supabase's default link", () => {
  it('V2C-37 · hands both tokens to Supabase to check, rather than trusting them', async () => {
    setSession.mockResolvedValue({ error: null });

    const result = await signInFromLinkFragment('#access_token=AT&expires_in=3600&refresh_token=RT&type=magiclink');

    expect(result).toEqual({ ok: true });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
  });

  it('V2C-38 · turns an expired or used link into the same friendly message as a bad code', async () => {
    const result = await signInFromLinkFragment(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );

    expect(result).toEqual({ ok: false, message: expect.stringContaining('expired or was already used') });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('V2C-39 · refuses a fragment missing either token', async () => {
    expect(await signInFromLinkFragment('#access_token=AT')).toMatchObject({ ok: false });
    expect(await signInFromLinkFragment('#type=magiclink')).toMatchObject({ ok: false });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('V2C-40 · reports a token the server rejects instead of claiming success', async () => {
    setSession.mockResolvedValue({ error: Object.assign(new Error('invalid'), { status: 401, code: 'bad_jwt' }) });

    const result = await signInFromLinkFragment('#access_token=forged&refresh_token=forged');

    expect(result.ok).toBe(false);
  });
});
