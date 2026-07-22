// Pure functions (exported for testing) — no I/O here. Same Eastern-day-
// boundary approach fixed tonight in Row's workout-nudge-logic.js and
// Vessel's journal-gap-logic.js — own local copy, not imported cross-repo.

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
