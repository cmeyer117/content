# Dashboard performance improvements — design

## Context

The Dashboard and Analytics pages currently surface activity metrics (idea counts, idea-creation velocity) rather than performance metrics (views, engagement). Two real gaps this closes:

1. The 07-27 analytics audit found an off-pillar post outperforming on-pillar content — a finding that took a manual Metricool pull to surface, because nothing in the app shows performance broken out by pillar.
2. `metricool_reach` and `metricool_engagement_rate` are synced weekly (`ingest-content-ideas.js` / the Metricool performance loop) but never rendered anywhere in the UI.

Real data as of 2026-08-05: 65 `TRACKED` posts (07-14 → 08-04), all with `views`, 61/65 with synced Metricool fields. Enough for meaningful charts, not sparse.

## Changes

### 1. Dashboard "By Pillar" — idea count → views

`Dashboard.tsx`'s existing "By Pillar" section (`countByPillar`) is replaced with a views-based version. Same `BarRow` component, same `PILLAR_HEX` colors — only the underlying metric changes.

New `chartData.ts` function:
```ts
export function sumViewsByPillar(ideas: ContentIdea[]): { pillar: Pillar; label: string; views: number }[]
```
Sums `views ?? 0` across `TRACKED` ideas per pillar (mirrors `countByPillar`'s shape/loop, swaps count for a views sum). Empty state unchanged (`EmptyState` already used when `ideas.length === 0`; if no `TRACKED` posts exist yet, all bars render at 0 — no special-cased empty state needed since the section itself isn't the only content on the page).

### 2. Analytics "Idea Velocity" — idea count → views

`Analytics.tsx`'s "Idea Velocity" section (`countByWeek`, bucketed by `created_at`) is replaced with a views-based weekly trend, bucketed by `posted_at` instead (a week only counts toward this chart once something in it has actually posted).

New `chartData.ts` function:
```ts
export function sumViewsByWeek(ideas: ContentIdea[]): { weekStart: string; views: number }[]
```
Reuses the existing `nyDateParts`/`mondayOfWeek` helpers already in `chartData.ts` — same week-bucketing logic as `countByWeek`, filtered to ideas with a non-null `posted_at`, summing `views ?? 0` instead of counting rows. Section label changes from "Idea Velocity" to "Views by Week".

### 3. New posting-streak day-grid (Dashboard)

New section on `Dashboard.tsx`, placed near the top (below Pipeline summary, above Lifetime stats) — a 30-day grid, one cell per NY-calendar day, colored by whether any idea's `posted_at` falls on that day (green) or not (gray). GitHub-contributions-style, single row or wrapped grid, no interactivity beyond a hover tooltip showing the date.

New `chartData.ts` function:
```ts
export function postedDaysSet(ideas: ContentIdea[]): Set<string> // YYYY-MM-DD (NY-local) keys
```
Built from existing `nyDateParts` — no new date-math needed. Component reads the last 30 calendar days (NY-local, computed at render time) and checks membership.

New component: `PostingStreakGrid.tsx` — takes `postedDays: Set<string>`, renders the grid. Pure presentational, same pattern as `BarRow`.

### 4. Metricool aggregate tiles (Dashboard)

Dashboard's existing "Lifetime (Tracked Posts)" stat grid (`Posts Tracked` / `Total Views` / `Total Shares` / `Ideas in Bank`) gains two more tiles: **Total Reach** and **Avg Engagement Rate**.

New `chartData.ts` function:
```ts
export function metricoolTotals(ideas: ContentIdea[]): { totalReach: number; avgEngagementRate: number | null }
```
`totalReach` sums `metricool_reach` where non-null across `TRACKED` ideas. `avgEngagementRate` averages `metricool_engagement_rate` where non-null (returns `null` if none synced yet, so the tile can render "—" instead of a misleading 0%). Confirmed via direct Supabase query (2026-08-05) that `metricool_engagement_rate` is already stored as a percentage value (e.g. `3.52` means 3.52%), not a 0-1 fraction — display as `{value.toFixed(1)}%` with no ×100 conversion.

## Testing

Each new `chartData.ts` function gets unit tests appended to the existing `src/__tests__/chartData.test.ts`, following that file's current style (plain Vitest, no fixtures/mocking — same pattern as `countByPillar`/`countByWeek`'s existing tests). `PostingStreakGrid.tsx` is presentational only (reads a `Set<string>`, no logic of its own) — no dedicated test needed, matching `BarRow`'s precedent of untested presentational components.

## Out of scope

- No backend/Supabase changes — everything needed is already in the `ideas` array `useIdeas()` loads today.
- No new dependencies.
- `getTopPerformer`/`getTopNByViews` (Spotlight, "Vs. Your Best") are untouched — still views-based, already correct.
- Per-post Metricool field display (Analytics cards) — deferred, not requested this round.
