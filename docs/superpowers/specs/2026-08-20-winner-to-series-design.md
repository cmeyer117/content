# Winner → Series Engine — Design

**Date:** 2026-08-20
**Status:** Draft — pending Carl's review
**Owner:** Content (`C:\Users\gregm\content`)

## Problem

When a post clearly outperforms, nothing in the app surfaces it as a signal to build on — Carl has to notice it himself in Analytics and manually decide to make more like it. This surfaces the signal automatically and turns it into one click: 3 linked DRAFT follow-ups (same-promise / objection / progression angles), still subject to the existing hook-gate before they can go READY.

## Ground truth (verified in-session)

- `ContentIdea` (`src/types/content.ts`) already has every "genome" field needed: `hook`, `hook_first_2s`, `viewer_payoff`, `content_class`, `pillar`, `target_length_seconds`. No new idea-level fields needed to capture genome — just copy these onto each follow-up.
- `PostPerformance` (`content_post_performance` table) has `views` per `(content_idea_id, platform)`, `posted_at`. `views` is this app's established comparison metric — `chartData.ts`'s `getTopPerformer`/`getTopNByViews`/`sumViewsByPillar` all rank by views, not engagement rate. Winner detection uses the same metric for consistency.
- `useIdeas()`'s `add(idea: NewContentIdea)` (`src/hooks/useIdeas.tsx`) is the single existing creation path — real-time Supabase insert + local state update. Reused as-is for creating the 3 follow-ups; no new insert path.
- Hook-gate (`isReadyForDraft`, `src/lib/hookGate.ts`) is enforced at `IdeaCard.tsx`'s status-transition UI, not at insert time — a new idea created via `add()` with `status: 'DRAFT'` automatically goes through the same gate everyone else does when it tries to move to READY. Nothing new to wire for "never skip to READY."
- `experimentRows`/`ExperimentQueue` (`src/lib/experiments.ts`, `Analytics.tsx`) is the closest existing precedent for "surface a comparison signal + a one-click action card" — same visual/structural pattern to follow for `WinnerSignals.tsx`, not a new UI language.
- No `.sql` migration files live in this repo — schema changes are applied directly via Supabase MCP (`execute_sql`/`apply_migration`), matching how `experiment_id`/`source_intel_insight_id` etc. were added per git history (`c59a579 feat: add experiments table and experiment_id field`).

## Scope

1. **Winner detection** — pure function, per platform independently: take the last 10 TRACKED posts on that platform (by `posted_at` descending), require ≥5 to compute a real baseline, median their `views`. A post is a winner if its `views` ≥ 2× that median AND it's ≥7 days post-`posted_at` (stats need time to stabilize) AND it hasn't already been used as a series source (checked via the new `series_source_performance_id` column — see below).
2. **`WinnerSignals.tsx`** on Analytics — one card per detected winner: the post's genome (hook/promise/format/length/pillar), its views vs. the baseline median, and a "Create 3 Follow-ups" button.
3. **One-click follow-up creation** — 3 new `content_ideas` rows, `status: 'DRAFT'`, genome fields copied from the source idea as a starting point (title/hook pre-filled, Carl edits before it can pass the hook-gate), each tagged with `series_source_performance_id` (the winning post's `content_post_performance.id`) and a distinct `angle`.

Out of scope (per the build plan's own reasoning, confirmed still true): Demand Radar-style comment/DM signals (not accessible), Conversion View follow-tracking (not captured this app). No auto-population of the 3 follow-ups' actual hook/copy beyond the genome starting point — the angle labels (same-promise/objection/progression) are a framing prompt for Carl to write into, not generated copy.

## Data model

3-column migration on `content_ideas` (applied via Supabase MCP, matching this repo's existing convention):
```sql
ALTER TABLE content_ideas
  ADD COLUMN series_source_performance_id uuid REFERENCES content_post_performance(id),
  ADD COLUMN angle text CHECK (angle IN ('same-promise', 'objection', 'progression')),
  ADD COLUMN position smallint CHECK (position BETWEEN 1 AND 3);
```
All three nullable — only follow-up ideas ever set them; every existing/manual idea keeps `null` across all three, same as `experiment_id`'s existing nullable pattern.

`ContentIdea` type gains the 3 matching optional fields.

## `src/lib/winners.ts`

Pure functions, matching `chartData.ts`/`experiments.ts`'s existing shape (no DOM/Supabase calls):

```ts
export type Winner = {
  idea: ContentIdeaWithPerformance
  perf: PostPerformance          // the winning platform's performance row
  baselineMedian: number
  multiple: number                // perf.views / baselineMedian
}

// Per platform: last-10-by-posted_at TRACKED posts on that platform form the
// baseline window. <5 posts on a platform -> no winners possible there yet
// (not enough signal for a real median).
export function detectWinners(ideas: ContentIdeaWithPerformance[], now: Date): Winner[]

// same-promise / objection / progression, in that fixed order -- angle is a
// writing prompt, not a generated line: "make the same case again, differently"
// / "answer the objection that stopped people acting on the promise" /
// "the next step after someone already acted on the first video."
export const SERIES_ANGLES: { angle: 'same-promise' | 'objection' | 'progression'; label: string; prompt: string }[]
```

Median: standard even/odd-length median over the baseline window's `views` array. A platform with an even-length baseline (e.g. exactly 10) averages the two middle values — matches the ordinary statistical definition, no house-specific variant needed here.

Excluding already-used sources: `detectWinners` filters out any performance row whose `id` already appears as some idea's `series_source_performance_id` — a winner only surfaces once, until Carl explicitly wants another round from the same post (out of scope for v1; would need a "re-run" affordance, not requested).

## UI

**`WinnerSignals.tsx`**, mounted on `Analytics.tsx` above `ExperimentQueue` (winners are a more time-sensitive signal than the experiment queue — surfacing first). Same `bg-card border border-border rounded-xl` card language as `ExperimentQueue`'s cards. Per winner: pillar badge + title, "X views vs Y median (Zx)", the genome fields as a compact read-out (hook / payoff / content_class / length), and the button.

Clicking "Create 3 Follow-ups" calls `useIdeas().add()` three times (`Promise.all`), once per `SERIES_ANGLES` entry, each with:
```ts
{
  title: `${sourceIdea.title} — ${angle.label}`,
  body: null,
  pillar: sourceIdea.pillar,
  platform: sourceIdea.platform,
  status: 'DRAFT',
  hook: sourceIdea.hook,
  content_class: sourceIdea.content_class,
  hook_first_2s: sourceIdea.hook_first_2s,
  viewer_payoff: sourceIdea.viewer_payoff,
  target_length_seconds: sourceIdea.target_length_seconds,
  // ...rest null/default, matching NewContentIdea's shape
  series_source_performance_id: perf.id,
  angle: angle.angle,
  position: index + 1,
}
```
After creation, the card collapses to a small "3 follow-ups created" confirmation (the winner is now filtered out of `detectWinners`'s next pass since its `series_source_performance_id` is in use).

## Error handling

- Fewer than 5 TRACKED posts on a platform → that platform contributes zero winners, no error state, `WinnerSignals` section just doesn't render for it.
- One of the 3 `add()` calls fails mid-`Promise.all` → matches `useIdeas`'s existing error convention (throw, caller catches) — the button shows an error state and does NOT mark the winner as used (no partial-series state where 1-2 of 3 exist silently); Carl can retry.
- A post exactly at the 7-day boundary or exactly 2.00x the median → inclusive (`>=`) on both, matches the spec's own "2x" and "≥7 days" wording literally.

## Testing

`src/__tests__/winners.test.ts`, matching `chartData.ts`'s existing test file shape: median calculation (odd/even baseline), the 2x + 7-day + already-used-source gating logic independently, per-platform independence (a TikTok winner shouldn't be gated by Instagram's baseline size or vice versa), and the angle/position assignment order.
