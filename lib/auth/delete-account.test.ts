import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * v3 Block F: the app's half of leaving.
 *
 * What the database does is tested against a real Postgres
 * (supabase/tests/delete-account.test.ts). What is tested here is everything
 * around that one call: that this browser's token is always dropped afterwards,
 * that a failure is reported rather than swallowed, and that nothing here ever
 * names an account.
 */

const fake = vi.hoisted(() => ({
  client: null as unknown,
  rpcCalls: [] as { fn: string; args: unknown }[],
  signOuts: [] as unknown[],
}));

vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => fake.client }));

type RpcAnswer = { data?: unknown; error?: unknown; throws?: boolean };

function client({ rpc, signOutThrows = false }: { rpc: RpcAnswer; signOutThrows?: boolean }) {
  return {
    rpc: async (fn: string, args: unknown) => {
      fake.rpcCalls.push({ fn, args });
      if (rpc.throws) throw new Error('network');
      return { data: rpc.data ?? null, error: rpc.error ?? null };
    },
    auth: {
      signOut: async (options: unknown) => {
        fake.signOuts.push(options);
        if (signOutThrows) throw new Error('storage is full');
        return { error: null };
      },
    },
  };
}

async function load() {
  vi.resetModules();
  return import('./actions');
}

beforeEach(() => {
  fake.client = null;
  fake.rpcCalls = [];
  fake.signOuts = [];
});

describe('deleting the account', () => {
  it('V3F-01 · ⭐ asks the database to delete the caller, naming nobody', async () => {
    fake.client = client({ rpc: { data: true } });
    const { deleteAccount } = await load();

    expect(await deleteAccount()).toEqual({ ok: true });
    expect(fake.rpcCalls).toEqual([{ fn: 'delete_my_account', args: undefined }]);
  });

  it('V3F-02 · ⭐ signs this device out afterwards', async () => {
    // The token keeps working until it expires. Leaving it would mean an app
    // that looks signed in to an account that no longer exists.
    fake.client = client({ rpc: { data: true } });
    const { deleteAccount } = await load();

    await deleteAccount();

    expect(fake.signOuts).toEqual([{ scope: 'local' }]);
  });

  it('V3F-03 · ⭐ a refused delete is reported, and nothing is signed out', async () => {
    fake.client = client({ rpc: { error: { message: 'permission denied' } } });
    const { deleteAccount } = await load();

    const result = await deleteAccount();

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/Couldn’t delete your account/);
    expect(fake.signOuts, 'still signed in, because the account is still there').toEqual([]);
  });

  it('V3F-04 · ⭐ no connection is said plainly, not as a mystery', async () => {
    fake.client = client({ rpc: { throws: true } });
    const { deleteAccount } = await load();

    const result = await deleteAccount();

    expect(result.ok === false && result.message).toMatch(/connection/);
    expect(fake.signOuts).toEqual([]);
  });

  it('V3F-05 · ⭐ "there was nobody to delete" signs out rather than pretending', async () => {
    // A stale token: the account went from another device. Staying signed in to
    // nothing is the one answer that helps no one.
    fake.client = client({ rpc: { data: false } });
    const { deleteAccount } = await load();

    const result = await deleteAccount();

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/not signed in/);
    expect(fake.signOuts).toEqual([{ scope: 'local' }]);
  });

  it('V3F-06 · ⭐ a sign-out that throws does not turn a finished delete into a failure', async () => {
    // By now the account really is gone. Rejecting here would escape into the
    // effect that called it and show nothing at all.
    fake.client = client({ rpc: { data: true }, signOutThrows: true });
    const { deleteAccount } = await load();

    await expect(deleteAccount()).resolves.toEqual({ ok: true });
  });

  it('V3F-07 · a build with no account settings says so instead of trying', async () => {
    fake.client = null;
    const { deleteAccount } = await load();

    const result = await deleteAccount();

    expect(result.ok).toBe(false);
    expect(fake.rpcCalls).toEqual([]);
  });
});
