// Vercel serverless function — authenticated replacement for the deleted
// anon-key scripts/ingest-content-ideas.js (removed 2026-08-14 when
// content_ideas RLS moved to authenticated+coaching_is_owner() only).
// Same CRON_SECRET bearer pattern as send-posting-cadence-nudge.js.
import { filterNewIdeas } from '../scripts/ingest-content-ideas-logic.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchExistingTitles(titles) {
  const filter = `(${titles.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')})`;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/content_ideas?title=in.${encodeURIComponent(filter)}&select=title`,
    { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
  );
  const rows = await r.json();
  return new Set(rows.map((row) => row.title));
}

async function insertIdeas(ideas) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/content_ideas`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(ideas),
  });
  if (!r.ok) throw new Error(`Supabase insert failed: ${r.status} ${await r.text()}`);
}

export async function handleIngestContentIdeasRequest(ideas) {
  if (!Array.isArray(ideas) || !ideas.length) {
    return { status: 400, body: { error: 'Body must be a non-empty array of ideas' } };
  }
  const existingTitles = await fetchExistingTitles(ideas.map((i) => i.title));
  const newIdeas = filterNewIdeas(ideas, existingTitles);
  if (newIdeas.length) await insertIdeas(newIdeas);
  return { status: 200, body: { candidates: ideas.length, existing: ideas.length - newIdeas.length, inserted: newIdeas.length } };
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
  try {
    const { status, body } = await handleIngestContentIdeasRequest(req.body?.ideas);
    res.status(status).json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
