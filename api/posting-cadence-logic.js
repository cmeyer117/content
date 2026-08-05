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

// True if any row's posted_at falls on today's Eastern-calendar date.
// Rows with a null posted_at (not yet posted) never match.
export function hasPostedToday(contentIdeaRows, now = new Date()) {
  const todayKey = todayEasternKey(now);
  return contentIdeaRows.some((row) => {
    if (!row.posted_at) return false;
    return todayEasternKey(new Date(row.posted_at)) === todayKey;
  });
}
