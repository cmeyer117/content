// Vercel serverless function (cron-triggered) — pushes a "no content
// posted today" nudge. Mirrors Row's send-macro-drift-nudge.js structure,
// including per-subscription failure reporting from the start (Row/Vessel
// had to retrofit this same night after discovering the GH Actions
// workflow only checked outer HTTP status, never sent/total).
import webpush from 'web-push';
import { hasPostedToday, buildNudgeMessage } from './posting-cadence-logic.js';
import { isAuthorizedCron } from './_cron-auth.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// READY = approved and shootable. Fetch the rows (not just a count) so the
// pure logic can name the top-scored one; the READY column stays small.
async function fetchReadyIdeas() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/content_ideas?status=eq.READY&select=id,title,predicted_score`,
    { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
  );
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
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

  const readyRows = await fetchReadyIdeas();
  const { body, url } = buildNudgeMessage(readyRows);
  const payload = JSON.stringify({
    title: 'Content Manager',
    body,
    ...(url ? { data: { url } } : {}),
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
  if (!isAuthorizedCron(req.headers['authorization'])) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { status, body } = await handleSendPostingCadenceNudgeRequest();
  res.status(status).json(body);
}
