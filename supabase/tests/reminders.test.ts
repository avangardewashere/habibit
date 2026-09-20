import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v3 Block D: the reminder tables, against a real database.
 *
 * A push endpoint is a capability — anyone holding it can wake that browser —
 * so these tables get the same treatment as habits: nobody sees anyone else's,
 * and signed-out visitors see nothing at all.
 */

const local = requireLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false } });

const publicClient = () => createClient(local.url, local.publishableKey, { auth: { persistSession: false } });

type TestUser = { id: string; db: SupabaseClient };

async function signedInUser(label: string): Promise<TestUser> {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: testEmail(label) });
  if (error) throw error;
  const db = publicClient();
  const { data, error: verifyError } = await db.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  });
  if (verifyError || !data.user) throw verifyError ?? new Error('no user');
  return { id: data.user.id, db };
}

const device = (endpoint: string) => ({ endpoint, p256dh: 'p256dh-value', auth: 'auth-value' });

let alice: TestUser;
let bob: TestUser;
const aliceEndpoint = 'https://push.example/alice-device';

beforeAll(async () => {
  [alice, bob] = await Promise.all([signedInUser('reminders-alice'), signedInUser('reminders-bob')]);

  const settings = await alice.db
    .from('reminder_settings')
    .insert({ enabled: true, local_time: '20:00', timezone: 'Asia/Manila' });
  const subscription = await alice.db.from('push_subscriptions').insert(device(aliceEndpoint));

  const errors = [settings.error, subscription.error].filter(Boolean);
  if (errors.length) throw new Error(`Test setup failed: ${JSON.stringify(errors)}`);
});

afterAll(async () => {
  await Promise.all([alice, bob].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
});

describe('V3D: reminder rows in the real database', () => {
  it('V3D-40 · ⭐ a signed-out visitor cannot read or write either table', async () => {
    for (const table of ['reminder_settings', 'push_subscriptions']) {
      const { data, error } = await publicClient().from(table).select('*');
      expect(data, table).toBeNull();
      expect(error?.code, table).toBe('42501'); // permission denied
    }
    const { error } = await publicClient().from('push_subscriptions').insert(device('https://push.example/nope'));
    expect(error?.code).toBe('42501');
  });

  it('V3D-41 · ⭐ one person cannot see another person’s devices or settings', async () => {
    const [devices, settings] = await Promise.all([
      bob.db.from('push_subscriptions').select('*'),
      bob.db.from('reminder_settings').select('*'),
    ]);
    expect(devices.data).toEqual([]);
    expect(settings.data).toEqual([]);
  });

  it('V3D-42 · ⭐ one person cannot delete another person’s device, even knowing its address', async () => {
    await bob.db.from('push_subscriptions').delete().eq('endpoint', aliceEndpoint);

    const { data } = await alice.db.from('push_subscriptions').select('endpoint');
    expect(data).toEqual([{ endpoint: aliceEndpoint }]);
  });

  it('V3D-43 · the row belongs to whoever is signed in, whatever the app sends', async () => {
    const endpoint = 'https://push.example/claimed';
    await bob.db.from('push_subscriptions').insert({ ...device(endpoint), user_id: alice.id });

    const { data } = await admin.from('push_subscriptions').select('user_id').eq('endpoint', endpoint);
    expect(data).toEqual([]);
  });

  it('V3D-44 · a reminder time has to be a quarter hour', async () => {
    for (const local_time of ['20:07', '20:00:30']) {
      const { error } = await bob.db
        .from('reminder_settings')
        .upsert({ enabled: true, local_time, timezone: 'UTC' }, { onConflict: 'user_id' });
      expect(error?.code, local_time).toBe('23514'); // check_violation
    }
  });

  it('V3D-45 · a device address has to be an https URL', async () => {
    for (const endpoint of ['http://push.example/insecure', 'not-a-url', 'https://x']) {
      const { error } = await bob.db.from('push_subscriptions').insert(device(endpoint));
      expect(error?.code, endpoint).toBe('23514');
    }
  });

  it('V3D-46 · the same device registering again updates its keys rather than duplicating', async () => {
    await alice.db
      .from('push_subscriptions')
      .upsert({ endpoint: aliceEndpoint, p256dh: 'new-p256dh', auth: 'new-auth' }, { onConflict: 'user_id,endpoint' });

    const { data } = await alice.db.from('push_subscriptions').select('endpoint,p256dh').eq('endpoint', aliceEndpoint);
    expect(data).toEqual([{ endpoint: aliceEndpoint, p256dh: 'new-p256dh' }]);
  });

  it('V3D-47 · deleting the account takes its reminders with it', async () => {
    const carol = await signedInUser('reminders-carol');
    await carol.db.from('reminder_settings').insert({ enabled: true, local_time: '07:15', timezone: 'UTC' });
    await carol.db.from('push_subscriptions').insert(device('https://push.example/carol-device'));

    await admin.auth.admin.deleteUser(carol.id);

    const counts = await Promise.all(
      ['reminder_settings', 'push_subscriptions'].map((table) =>
        admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', carol.id),
      ),
    );
    expect(counts.map((c) => c.count)).toEqual([0, 0]);
  });
});
