// @ts-nocheck — this file runs on Deno inside Supabase, not on Node. Its
// imports (`npm:`, `jsr:`) and its globals (`Deno`) mean nothing to this repo's
// TypeScript, so it is excluded from `npm run typecheck` and from eslint. The
// decisions worth testing are in ./reminders.ts, which has no imports and is
// covered by `npm test`.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isAuthorised, isGone, sendReminders, type Device } from './reminders.ts';

/*
 * Habibit v3 Block E: the scheduled sender.
 *
 * Called every quarter hour by pg_cron (supabase/cron/schedule-reminders.sql).
 * It asks the database who is due, sends each of their devices one push, and
 * deletes the addresses the push service says no longer exist.
 *
 * ## Why this runs in Supabase and not in the app
 *
 * It needs two things the app must never hold: the **VAPID private key**, which
 * can send a notification to anyone who ever subscribed, and the **secret
 * database key**, which can read every account. Both live in Supabase's secrets
 * and never leave it. Vercel's free scheduler also only runs once a day, which
 * is no use for a time you chose yourself.
 *
 * ## Deploying it
 *
 *   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
 *   npx supabase functions deploy send-reminders
 *
 * The private key goes to that command from wherever you kept it. It does not
 * belong in this repo, in .env.local, or in Vercel.
 */

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
// Push services want a way to contact whoever is sending, if something is wrong.
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminders@habibit.app';

// Supabase puts these into every function; neither is written down anywhere.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/** Turns `web-push`'s exception into the plain answer ./reminders.ts works in. */
async function pushToDevice(device: Device, notification: { title: string; body: string }) {
  try {
    await webpush.sendNotification(
      {
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth },
      },
      JSON.stringify(notification),
      // Long enough to survive a phone that is asleep at 8 pm, short enough
      // that a reminder never arrives the next morning.
      { TTL: 4 * 60 * 60 },
    );
    return { ok: true } as const;
  } catch (error) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 0;
    return { ok: false, gone: isGone(status) } as const;
  }
}

Deno.serve(async (request: Request) => {
  const answer = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  // Supabase checks that a caller holds *a* key before this runs, and the key
  // the app ships in every browser is one of those. This checks it is the
  // secret one, which only the scheduler inside Supabase has.
  if (!isAuthorised(request.headers.get('Authorization'), secretKey)) {
    return answer({ error: 'not allowed' }, 401);
  }

  if (!vapidPublicKey || !vapidPrivateKey || !supabaseUrl || !secretKey) {
    // Said plainly rather than silently sending nothing: a missing secret is a
    // setup mistake, and it should be obvious in the function's logs.
    return answer({ error: 'sender is not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

  // `claim` rather than `ask`: it writes down that today's reminder has gone
  // before handing the list over, so two overlapping runs cannot both send.
  const { data: due, error: dueError } = await supabase.rpc('claim_due_reminders');
  if (dueError) return answer({ error: dueError.message }, 500);
  if (!due || due.length === 0) return answer({ due: 0, sent: 0 });

  const { data: devices, error: deviceError } = await supabase
    .from('push_subscriptions')
    .select('user_id,endpoint,p256dh,auth')
    .in(
      'user_id',
      due.map((person) => person.user_id),
    );
  if (deviceError) return answer({ error: deviceError.message }, 500);

  const report = await sendReminders(due, devices ?? [], pushToDevice);

  // Addresses the push service says are dead. Keeping them would mean trying
  // every one of them, every day, forever.
  for (const device of report.gone) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', device.user_id)
      .eq('endpoint', device.endpoint);
  }

  return answer({
    due: due.length,
    sent: report.sent,
    failed: report.failed,
    forgotten: report.gone.length,
    unreachable: report.unreachable.length,
  });
});
