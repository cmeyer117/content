// Vercel serverless function (cron-triggered) — pushes a "no content
// posted today" nudge. Mirrors Row's send-macro-drift-nudge.js structure,
// including per-subscription failure reporting from the start (Row/Vessel
// had to retrofit this same night after discovering the GH Actions
// workflow only checked outer HTTP status, never sent/total).
import webpush from 'web-push';
import { hasPostedToday } from './posting-cadence-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

webpush.setVapidDetails(
  'mailto:carl.meyer.business@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function fetchRecentContentIdeas() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/content_ideas?posted_at=not.is.null&select=posted_at&order=posted_at.desc&limit=20`,
    { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
  );
  return r.json();
}

async function fetchBankedIdeaCount() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/content_ideas?status=eq.IDEA&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Prefer: 'count=exact' } }
  );
  const range = r.headers.get('content-range'); // e.g. "0-19/48"
  const total = range ? Number(range.split('/')[1]) : 0;
  return Number.isNaN(total) ? 0 : total;
}

async function fetchSubscriptions() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?app=eq.content&select=endpoint,p256dh,auth`, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  });
  return r.json();
}

async function deleteSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  }).catch(() => {});
}

export async function handleSendPostingCadenceNudgeRequest() {
  const now = new Date();

  const recentRows = await fetchRecentContentIdeas();
  if (hasPostedToday(recentRows, now)) {
    return { status: 200, body: { message: 'Posted today, no push sent' } };
  }

  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  const banked = await fetchBankedIdeaCount();
  const payload = JSON.stringify({
    title: 'Content Manager',
    body: `No content posted today — ${banked} ideas banked, ship one.`,
  });

  let sent = 0;
  const failures = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 410) await deleteSubscription(sub.endpoint);
      failures.push({ endpointHost: new URL(sub.endpoint).host, statusCode: e.statusCode, message: e.body || e.message });
    }
  }
  return { status: 200, body: { message: 'Pushed', sent, total: subs.length, failures } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { status, body } = await handleSendPostingCadenceNudgeRequest();
  res.status(status).json(body);
}
