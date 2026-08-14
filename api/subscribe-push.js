// Vercel serverless function — stores a browser's push subscription so
// send-posting-cadence-nudge.js can push to it later. Requires the caller's
// Supabase session token to belong to the owner account before writing via
// the service-role key.
import { buildSubscribeUpsertRequest, verifyOwner } from './subscribe-push-logic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await verifyOwner(req.headers.authorization))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    res.status(400).json({ error: 'Missing subscription fields' });
    return;
  }
  try {
    const { url, options } = buildSubscribeUpsertRequest('content', endpoint, keys);
    const r = await fetch(url, options);
    if (!r.ok) {
      res.status(502).json({ error: 'Supabase upsert failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Subscribe failed' });
  }
}
