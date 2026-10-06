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

// Codex audit 2026-10-06 (finding 5): a read that failed used to look like an empty one. A failed read now throws a
// DependencyError the handler turns into a 502, so the GitHub workflow (which fails on any non-200) goes red instead of green.
class DependencyError extends Error {
  constructor(which, detail) {
    super(`${which} unavailable: ${detail}`);
    this.which = which;
  }
}

// Every Supabase read gets a deadline. NUDGE_READ_TIMEOUT_MS exists only so the tests run in milliseconds: it can only shorten
// the 10 s budget and is ignored when NODE_ENV is "production".
const READ_TIMEOUT_MS = 10_000;
const PUSH_TIMEOUT_MS = 10_000;
function readTimeoutMs() {
  if (process.env.NODE_ENV === 'production') return READ_TIMEOUT_MS;
  const override = Number(process.env.NUDGE_READ_TIMEOUT_MS);
  return override > 0 ? Math.min(READ_TIMEOUT_MS, Math.round(override)) : READ_TIMEOUT_MS;
}

async function readRows(which, path) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      signal: AbortSignal.timeout(readTimeoutMs()),
    });
  } catch (e) {
    throw new DependencyError(which, e && e.name === 'TimeoutError' ? 'timed out' : String(e && e.message));
  }
  if (!r.ok) throw new DependencyError(which, `HTTP ${r.status}`);
  let rows;
  try {
    rows = await r.json();
  } catch {
    throw new DependencyError(which, 'response was not JSON');
  }
  if (!Array.isArray(rows)) throw new DependencyError(which, 'response was not a list');
  return rows;
}

const fetchRecentContentIdeas = () =>
  readRows('recent_posts', 'content_ideas?posted_at=not.is.null&select=posted_at&order=posted_at.desc&limit=20');

// READY = approved and shootable. Fetch the rows (not just a count) so the
// pure logic can name the top-scored one; the READY column stays small.
const fetchReadyIdeas = () => readRows('ready_ideas', 'content_ideas?status=eq.READY&select=id,title,predicted_score');

const fetchSubscriptions = () => readRows('subscriptions', 'push_subscriptions?app=eq.content&select=endpoint,p256dh,auth');

// A stored endpoint that is not a URL must not throw out of the failure report and abandon the other subscribers.
function endpointHost(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid-endpoint';
  }
}

async function deleteSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    signal: AbortSignal.timeout(readTimeoutMs()),
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  }).catch(() => {});
}

async function runNudge() {
  const now = new Date();

  const recentRows = await fetchRecentContentIdeas();
  if (hasPostedToday(recentRows, now)) {
    return { status: 200, body: { message: 'Posted today, no push sent' } };
  }

  const subs = await fetchSubscriptions();
  if (!subs.length) {
    return { status: 200, body: { message: 'No subscriptions, no push sent' } };
  }

  // The nudge's job is to remind Carl to post, so an unreadable READY list degrades the message (no claim about approved ideas)
  // instead of failing the run, and the response says so.
  const degraded = [];
  let readyRows = null;
  try {
    readyRows = await fetchReadyIdeas();
  } catch (e) {
    if (!(e instanceof DependencyError)) throw e;
    degraded.push(e.which);
  }
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
        payload,
        { timeout: PUSH_TIMEOUT_MS }
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 410) await deleteSubscription(sub.endpoint);
      failures.push({ endpointHost: endpointHost(sub.endpoint), statusCode: e.statusCode, message: e.body || e.message });
    }
  }
  // 200 "Pushed" with sent < total is the contract posting-cadence-nudge.yml fails the job on: keep it exactly.
  return { status: 200, body: { message: 'Pushed', sent, total: subs.length, failures, ...(degraded.length ? { degraded } : {}) } };
}

export async function handleSendPostingCadenceNudgeRequest() {
  try {
    return await runNudge();
  } catch (e) {
    if (e instanceof DependencyError) {
      return { status: 502, body: { error: 'dependency_unavailable', which: e.which, detail: e.message } };
    }
    throw e;
  }
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
