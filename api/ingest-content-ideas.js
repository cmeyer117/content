// Vercel serverless function — authenticated replacement for the deleted
// anon-key scripts/ingest-content-ideas.js (removed 2026-08-14 when
// content_ideas RLS moved to authenticated+coaching_is_owner() only).
// Same CRON_SECRET bearer pattern as send-posting-cadence-nudge.js.
const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// DB-enforced dedup via content_ideas.source_key (partial unique index) replaces the old
// fetch-existing-titles-then-POST race, where two concurrent calls could both see no match
// and both insert. Prefer: resolution=ignore-duplicates makes this an upsert-on-conflict.
async function insertIdeas(ideas) {
  const rows = ideas.map((i) => ({ ...i, source_key: `ingest:${i.title}` }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/content_ideas?on_conflict=source_key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase insert failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function handleIngestContentIdeasRequest(ideas) {
  if (!Array.isArray(ideas) || !ideas.length) {
    return { status: 400, body: { error: 'Body must be a non-empty array of ideas' } };
  }
  if (ideas.some((i) => typeof i.title !== 'string' || !i.title.trim())) {
    return { status: 400, body: { error: 'Every idea needs a non-empty string title' } };
  }
  const insertedRows = await insertIdeas(ideas);
  return { status: 200, body: { candidates: ideas.length, existing: ideas.length - insertedRows.length, inserted: insertedRows.length } };
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
