// Pure functions (exported for testing) — no I/O here. Same Eastern-day-
// boundary approach fixed tonight in Row's workout-nudge-logic.js and
// Vessel's journal-gap-logic.js — own local copy, not imported cross-repo.

// ponytail: from Metricool getBestTimeToPostByNetwork, 7-day pull 2026-08-05
// (both TikTok and IG peak ~10am ET and ~6pm ET, every day) — hardcoded since
// the pattern is stable and re-querying live would need Metricool creds in
// this serverless function for no real benefit. Re-check if posting hours drift.
export const BEST_WINDOW_ET = '10am or 6pm ET';

export function todayEasternKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Deep link for the nudge. The Pipeline page has no idea-selection URL
// param yet, so the best we can do is land on the board (READY column
// is visible there). Switch to an idea-specific link once the app grows one.
export const PIPELINE_URL = '/pipeline';

// The READY idea with the highest predicted_score. A missing/null score
// ranks below any real score; ties keep input order; empty list -> null.
export function pickTopReadyIdea(readyRows) {
  if (!Array.isArray(readyRows) || readyRows.length === 0) return null;
  const score = (row) => (typeof row.predicted_score === 'number' ? row.predicted_score : -Infinity);
  return readyRows.reduce((best, row) => (score(row) > score(best) ? row : best), readyRows[0]);
}

// Push body + optional deep link for the 8pm nudge. Counts READY (approved)
// posts, not IDEA — the raw idea pile is huge and demotivating, and it is
// not what Carl should be picking from at 8pm.
export function buildNudgeMessage(readyRows) {
  const rows = Array.isArray(readyRows) ? readyRows : [];
  const top = pickTopReadyIdea(rows);
  if (!top) {
    return { body: 'No content posted today. Nothing approved yet, open the autopilot cards.' };
  }
  return {
    body: `No content posted today — post now to catch ${BEST_WINDOW_ET}. Top pick: "${top.title}" (${rows.length} ready).`,
    url: PIPELINE_URL,
  };
}

// True if any row's posted_at falls on today's Eastern-calendar date.
// Rows with a null posted_at (not yet posted) never match.
export function hasPostedToday(contentIdeaRows, now = new Date()) {
  const todayKey = todayEasternKey(now);
  return contentIdeaRows.some((row) => {
    if (!row.posted_at) return false;
    return todayEasternKey(new Date(row.posted_at)) === todayKey;
  });
}
