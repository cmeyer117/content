# Dashboard Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the Content Manager Dashboard/Analytics pages from activity metrics (idea counts, idea-creation velocity) to performance metrics (views, engagement), and surface the Metricool fields that sync weekly but currently render nowhere.

**Architecture:** All four features are pure-function additions to the existing `src/lib/chartData.ts` module, wired into the existing `Dashboard.tsx`/`Analytics.tsx` pages via the same `BarRow`/`EmptyState` components already in use. No backend, schema, or dependency changes — everything needed is already in the `ideas` array `useIdeas()` loads.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind. Repo: `C:\Users\gregm\content` (GitHub: `cmeyer117/content`).

---

## Before you start

All commands below assume the working directory is `C:\Users\gregm\content`.

Run the existing suite once to confirm a clean baseline:
```bash
npm test
```
Expected: all existing tests pass (chartData, posting-cadence, ingest-content-ideas, push-subscribe suites).

---

### Task 1: `sumViewsByPillar` — pillar performance

**Files:**
- Modify: `src/lib/chartData.ts`
- Test: `src/__tests__/chartData.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/chartData.test.ts`, after the `countByPillar` import — update the import line first:

```ts
import { countByPillar, countByStage, countByWeek, countByPillarAndStage, getTopPerformer, getTopNByViews, sumViewsByPillar, sumViewsByWeek, postedDaysSet, metricoolTotals } from '@/lib/chartData'
```

Then add this new `describe` block (place it right after the `countByPillar` block, before `describe('countByStage', ...)`):

```ts
describe('sumViewsByPillar', () => {
  it('sums views per pillar for TRACKED ideas only', () => {
    const ideas = [
      makeIdea({ pillar: 'training', status: 'TRACKED', views: 100 }),
      makeIdea({ pillar: 'training', status: 'TRACKED', views: 50 }),
      makeIdea({ pillar: 'faith', status: 'TRACKED', views: 30 }),
      makeIdea({ pillar: 'training', status: 'IDEA', views: 9000 }), // not TRACKED, ignored
    ]
    const result = sumViewsByPillar(ideas)
    expect(result).toHaveLength(5)
    expect(result.find(r => r.pillar === 'training')?.views).toBe(150)
    expect(result.find(r => r.pillar === 'faith')?.views).toBe(30)
    expect(result.find(r => r.pillar === 'diet')?.views).toBe(0)
  })

  it('treats null views as 0', () => {
    const ideas = [makeIdea({ pillar: 'life', status: 'TRACKED', views: null })]
    const result = sumViewsByPillar(ideas)
    expect(result.find(r => r.pillar === 'life')?.views).toBe(0)
  })

  it('returns all-zero views for an empty array', () => {
    const result = sumViewsByPillar([])
    expect(result).toHaveLength(5)
    expect(result.every(r => r.views === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- chartData`
Expected: FAIL — `sumViewsByPillar` is not exported from `@/lib/chartData`.

- [ ] **Step 3: Write the implementation**

In `src/lib/chartData.ts`, add this function directly after `countByPillar` (which ends at line 10):

```ts
export function sumViewsByPillar(ideas: ContentIdea[]): { pillar: Pillar; label: string; views: number }[] {
  const tracked = ideas.filter(i => i.status === 'TRACKED')
  return PILLARS.map(p => ({
    pillar: p.value,
    label: p.label,
    views: tracked.filter(i => i.pillar === p.value).reduce((sum, i) => sum + (i.views ?? 0), 0),
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- chartData`
Expected: PASS, including the 3 new `sumViewsByPillar` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartData.ts src/__tests__/chartData.test.ts
git commit -m "feat: add sumViewsByPillar for pillar-performance chart"
```

---

### Task 2: `sumViewsByWeek` — weekly views trend

**Files:**
- Modify: `src/lib/chartData.ts`
- Test: `src/__tests__/chartData.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `src/__tests__/chartData.test.ts`, right after the `countByWeek` block:

```ts
describe('sumViewsByWeek', () => {
  it('returns an empty array when nothing has posted_at set', () => {
    expect(sumViewsByWeek([makeIdea({ posted_at: null, views: 500 })])).toEqual([])
  })

  it('buckets by posted_at (America/New_York), summing views instead of counting', () => {
    const ideas = [
      makeIdea({ posted_at: '2026-01-05T12:00:00Z', views: 100 }),
      makeIdea({ posted_at: '2026-01-06T12:00:00Z', views: 50 }),
      makeIdea({ posted_at: '2026-01-19T12:00:00Z', views: 30 }),
    ]
    const result = sumViewsByWeek(ideas)
    expect(result).toEqual([
      { weekStart: '2026-01-05', views: 150 },
      { weekStart: '2026-01-12', views: 0 },
      { weekStart: '2026-01-19', views: 30 },
    ])
  })

  it('treats null views as 0 and ignores ideas with no posted_at', () => {
    const ideas = [
      makeIdea({ posted_at: '2026-01-05T12:00:00Z', views: null }),
      makeIdea({ posted_at: null, views: 9000 }),
    ]
    expect(sumViewsByWeek(ideas)).toEqual([{ weekStart: '2026-01-05', views: 0 }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- chartData`
Expected: FAIL — `sumViewsByWeek` is not exported from `@/lib/chartData`.

- [ ] **Step 3: Write the implementation**

In `src/lib/chartData.ts`, add this function directly after `countByWeek` (which uses the existing `nyDateParts`/`mondayOfWeek` helpers already defined above it in the file):

```ts
export function sumViewsByWeek(ideas: ContentIdea[]): { weekStart: string; views: number }[] {
  const posted = ideas.filter((i): i is ContentIdea & { posted_at: string } => i.posted_at !== null)
  if (posted.length === 0) return []

  const sums = new Map<string, number>()
  for (const idea of posted) {
    const { year, month, day } = nyDateParts(idea.posted_at)
    const week = mondayOfWeek(year, month, day)
    sums.set(week, (sums.get(week) ?? 0) + (idea.views ?? 0))
  }

  const weeks = [...sums.keys()].sort()
  const result: { weekStart: string; views: number }[] = []
  const cursor = new Date(`${weeks[0]}T12:00:00Z`)
  const last = new Date(`${weeks[weeks.length - 1]}T12:00:00Z`)
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ weekStart: key, views: sums.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- chartData`
Expected: PASS, including the 3 new `sumViewsByWeek` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartData.ts src/__tests__/chartData.test.ts
git commit -m "feat: add sumViewsByWeek for the views-by-week trend"
```

---

### Task 3: `postedDaysSet` — posting streak data

**Files:**
- Modify: `src/lib/chartData.ts`
- Test: `src/__tests__/chartData.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `src/__tests__/chartData.test.ts`, after the `sumViewsByWeek` block:

```ts
describe('postedDaysSet', () => {
  it('returns NY-local YYYY-MM-DD keys for every idea with a posted_at', () => {
    const ideas = [
      makeIdea({ posted_at: '2026-01-05T12:00:00Z' }), // noon UTC = 7am EST, still Jan 5 in NY
      makeIdea({ posted_at: '2026-01-06T04:30:00Z' }), // 4:30am UTC = Jan 5 11:30pm EST, previous day
    ]
    const result = postedDaysSet(ideas)
    expect(result.has('2026-01-05')).toBe(true)
    expect(result.has('2026-01-06')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('ignores ideas with no posted_at', () => {
    const result = postedDaysSet([makeIdea({ posted_at: null })])
    expect(result.size).toBe(0)
  })

  it('returns an empty set for an empty array', () => {
    expect(postedDaysSet([]).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- chartData`
Expected: FAIL — `postedDaysSet` is not exported from `@/lib/chartData`.

- [ ] **Step 3: Write the implementation**

In `src/lib/chartData.ts`, add this function after `sumViewsByWeek`, reusing the existing `nyDateParts` helper (already defined near the top of the file):

```ts
export function postedDaysSet(ideas: ContentIdea[]): Set<string> {
  const days = new Set<string>()
  for (const idea of ideas) {
    if (!idea.posted_at) continue
    const { year, month, day } = nyDateParts(idea.posted_at)
    days.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return days
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- chartData`
Expected: PASS, including the 3 new `postedDaysSet` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartData.ts src/__tests__/chartData.test.ts
git commit -m "feat: add postedDaysSet for the posting-streak grid"
```

---

### Task 4: `metricoolTotals` — surface synced Metricool fields

**Files:**
- Modify: `src/lib/chartData.ts`
- Test: `src/__tests__/chartData.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `src/__tests__/chartData.test.ts`, after the `postedDaysSet` block:

```ts
describe('metricoolTotals', () => {
  it('sums metricool_reach and averages metricool_engagement_rate across TRACKED ideas', () => {
    const ideas = [
      makeIdea({ status: 'TRACKED', metricool_reach: 100, metricool_engagement_rate: 2.5 }),
      makeIdea({ status: 'TRACKED', metricool_reach: 200, metricool_engagement_rate: 7.5 }),
      makeIdea({ status: 'IDEA', metricool_reach: 9000, metricool_engagement_rate: 99 }), // not TRACKED, ignored
    ]
    const result = metricoolTotals(ideas)
    expect(result.totalReach).toBe(300)
    expect(result.avgEngagementRate).toBe(5)
  })

  it('treats null metricool_reach as 0 but excludes null metricool_engagement_rate from the average', () => {
    const ideas = [
      makeIdea({ status: 'TRACKED', metricool_reach: null, metricool_engagement_rate: null }),
      makeIdea({ status: 'TRACKED', metricool_reach: 100, metricool_engagement_rate: 4 }),
    ]
    const result = metricoolTotals(ideas)
    expect(result.totalReach).toBe(100)
    expect(result.avgEngagementRate).toBe(4)
  })

  it('returns avgEngagementRate: null when no TRACKED idea has synced data yet', () => {
    const result = metricoolTotals([makeIdea({ status: 'TRACKED', metricool_engagement_rate: null })])
    expect(result.avgEngagementRate).toBeNull()
  })

  it('returns totalReach: 0 and avgEngagementRate: null for an empty array', () => {
    const result = metricoolTotals([])
    expect(result.totalReach).toBe(0)
    expect(result.avgEngagementRate).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- chartData`
Expected: FAIL — `metricoolTotals` is not exported from `@/lib/chartData`.

- [ ] **Step 3: Write the implementation**

In `src/lib/chartData.ts`, add this function after `postedDaysSet`. Note `metricool_engagement_rate` is stored in Supabase as a plain percentage (e.g. `3.52` means 3.52%, confirmed via direct query 2026-08-05) — do not multiply by 100 anywhere:

```ts
export function metricoolTotals(ideas: ContentIdea[]): { totalReach: number; avgEngagementRate: number | null } {
  const tracked = ideas.filter(i => i.status === 'TRACKED')
  const totalReach = tracked.reduce((sum, i) => sum + (i.metricool_reach ?? 0), 0)
  const rates = tracked.map(i => i.metricool_engagement_rate).filter((r): r is number => r !== null)
  const avgEngagementRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : null
  return { totalReach, avgEngagementRate }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- chartData`
Expected: PASS, including the 4 new `metricoolTotals` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartData.ts src/__tests__/chartData.test.ts
git commit -m "feat: add metricoolTotals for the reach/engagement dashboard tiles"
```

---

### Task 5: `PostingStreakGrid` component

**Files:**
- Create: `src/components/PostingStreakGrid.tsx`

This is a pure presentational component (reads a `Set<string>`, no logic of its own) — following the same untested-presentational precedent as `src/components/BarRow.tsx`, no dedicated test file.

- [ ] **Step 1: Write the component**

Create `src/components/PostingStreakGrid.tsx`:

```tsx
type Props = { postedDays: Set<string> }

// Same America/New_York day-key format as chartData.ts's postedDaysSet (YYYY-MM-DD),
// computed independently here since this is a presentational file, not chartData.ts —
// mirrors the "own local copy, not imported cross-repo" precedent in
// api/posting-cadence-logic.js for the same NY-day-boundary concern.
function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
}

export default function PostingStreakGrid({ postedDays }: Props) {
  const days: { key: string; posted: boolean }[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = nyDateKey(d)
    days.push({ key, posted: postedDays.has(key) })
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {days.map(d => (
        <div
          key={d.key}
          title={d.key}
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: d.posted ? '#16a34a' : '#e5e7eb' }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors from `PostingStreakGrid.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PostingStreakGrid.tsx
git commit -m "feat: add PostingStreakGrid presentational component"
```

---

### Task 6: Wire pillar performance, streak grid, and Metricool tiles into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace the imports**

In `src/pages/Dashboard.tsx`, replace lines 1-6:

```tsx
import { useIdeas } from '@/hooks/useIdeas'
import { PIPELINE_STAGES, PILLAR_HEX, PIPELINE_STAGE_COLORS, PILLARS } from '@/lib/constants'
import { countByPillar, getTopPerformer, getTopNByViews } from '@/lib/chartData'
import BarRow from '@/components/BarRow'
import SpotlightCard from '@/components/SpotlightCard'
import EmptyState from '@/components/EmptyState'
```

with:

```tsx
import { useIdeas } from '@/hooks/useIdeas'
import { PIPELINE_STAGES, PILLAR_HEX, PIPELINE_STAGE_COLORS, PILLARS } from '@/lib/constants'
import { sumViewsByPillar, getTopPerformer, getTopNByViews, postedDaysSet, metricoolTotals } from '@/lib/chartData'
import BarRow from '@/components/BarRow'
import SpotlightCard from '@/components/SpotlightCard'
import EmptyState from '@/components/EmptyState'
import PostingStreakGrid from '@/components/PostingStreakGrid'
```

- [ ] **Step 2: Add the new computed values**

In `src/pages/Dashboard.tsx`, replace lines 15-21:

```tsx
  const tracked = ideas.filter(i => i.status === 'TRACKED')
  const totalViews = tracked.reduce((sum, i) => sum + (i.views ?? 0), 0)
  const totalShares = tracked.reduce((sum, i) => sum + (i.shares ?? 0), 0)

  const topPerformer = getTopPerformer(ideas)
  const topByViews = getTopNByViews(ideas, 5)
  const maxViews = topByViews[0]?.views ?? 0
```

with:

```tsx
  const tracked = ideas.filter(i => i.status === 'TRACKED')
  const totalViews = tracked.reduce((sum, i) => sum + (i.views ?? 0), 0)
  const totalShares = tracked.reduce((sum, i) => sum + (i.shares ?? 0), 0)

  const topPerformer = getTopPerformer(ideas)
  const topByViews = getTopNByViews(ideas, 5)
  const maxViews = topByViews[0]?.views ?? 0

  const postedDays = postedDaysSet(ideas)
  const { totalReach, avgEngagementRate } = metricoolTotals(ideas)

  const pillarViews = sumViewsByPillar(ideas)
  const maxPillarViews = Math.max(1, ...pillarViews.map(p => p.views))
```

- [ ] **Step 3: Add the Posting Streak section**

In `src/pages/Dashboard.tsx`, find the `{/* Aggregate stats */}` comment (originally line 47) and insert a new section directly before it:

```tsx
      {/* Posting Streak */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Last 30 Days</p>
        <PostingStreakGrid postedDays={postedDays} />
      </section>

      {/* Aggregate stats */}
```

- [ ] **Step 4: Add the two Metricool tiles**

In `src/pages/Dashboard.tsx`, replace the aggregate-stats array (originally lines 50-55):

```tsx
          {[
            { label: 'Posts Tracked', value: tracked.length },
            { label: 'Total Views', value: totalViews.toLocaleString() },
            { label: 'Total Shares', value: totalShares.toLocaleString() },
            { label: 'Ideas in Bank', value: ideas.length },
          ].map(s => (
```

with:

```tsx
          {[
            { label: 'Posts Tracked', value: tracked.length },
            { label: 'Total Views', value: totalViews.toLocaleString() },
            { label: 'Total Shares', value: totalShares.toLocaleString() },
            { label: 'Ideas in Bank', value: ideas.length },
            { label: 'Total Reach', value: totalReach.toLocaleString() },
            { label: 'Avg Engagement Rate', value: avgEngagementRate !== null ? `${avgEngagementRate.toFixed(1)}%` : '—' },
          ].map(s => (
```

- [ ] **Step 5: Replace the "By Pillar" section with performance data**

In `src/pages/Dashboard.tsx`, replace the entire Pillar breakdown section (originally lines 90-109):

```tsx
      {/* Pillar breakdown */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">By Pillar</p>
        <div className="flex flex-col gap-2">
          {ideas.length === 0 ? (
            <EmptyState message="No ideas yet — add your first one on the Ideas page." icon="💡" />
          ) : (
            countByPillar(ideas).map(p => (
              <BarRow
                key={p.pillar}
                label={p.label}
                count={p.count}
                max={ideas.length}
                color={PILLAR_HEX[p.pillar]}
                icon={PILLARS.find(pl => pl.value === p.pillar)?.icon}
              />
            ))
          )}
        </div>
      </section>
```

with:

```tsx
      {/* Pillar performance */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">By Pillar (Views)</p>
        <div className="flex flex-col gap-2">
          {tracked.length === 0 ? (
            <EmptyState message="No tracked posts yet — mark a post TRACKED with real views to see pillar performance." icon="📊" />
          ) : (
            pillarViews.map(p => (
              <BarRow
                key={p.pillar}
                label={p.label}
                count={p.views}
                max={maxPillarViews}
                color={PILLAR_HEX[p.pillar]}
                icon={PILLARS.find(pl => pl.value === p.pillar)?.icon}
              />
            ))
          )}
        </div>
      </section>
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no errors. `PILLARS` and `PIPELINE_STAGE_COLORS` remain used elsewhere in the file (Pipeline summary section) — confirm no unused-import errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: wire pillar performance, posting streak, and Metricool tiles into Dashboard"
```

---

### Task 7: Replace Analytics' "Idea Velocity" with weekly views

**Files:**
- Modify: `src/pages/Analytics.tsx`

- [ ] **Step 1: Update the import**

In `src/pages/Analytics.tsx`, replace line 6:

```tsx
import { countByStage, countByWeek, countByPillarAndStage } from '@/lib/chartData'
```

with:

```tsx
import { countByStage, sumViewsByWeek, countByPillarAndStage } from '@/lib/chartData'
```

- [ ] **Step 2: Update the `formatWeekRange` helper's parameter type**

In `src/pages/Analytics.tsx`, `formatWeekRange` (lines 12-16) already types its parameter as `{ weekStart: string }[]`, which is structurally compatible with `sumViewsByWeek`'s `{ weekStart: string; views: number }[]` return type — no change needed here.

- [ ] **Step 3: Replace the computed values and section**

In `src/pages/Analytics.tsx`, replace lines 45-48:

```tsx
  const stageData = countByStage(ideas)
  const maxStageCount = Math.max(1, ...stageData.map(s => s.count))
  const weekData = countByWeek(ideas)
  const maxWeekCount = Math.max(1, ...weekData.map(w => w.count))
```

with:

```tsx
  const stageData = countByStage(ideas)
  const maxStageCount = Math.max(1, ...stageData.map(s => s.count))
  const weekData = sumViewsByWeek(ideas)
  const maxWeekViews = Math.max(1, ...weekData.map(w => w.views))
```

Then replace lines 70-83 (the "Idea Velocity" block):

```tsx
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
            Idea Velocity{weekData.length > 0 && <span className="normal-case font-normal text-gray-600"> — {formatWeekRange(weekData)}</span>}
          </p>
          {weekData.length === 0 ? (
            <p className="text-xs text-gray-600">No ideas yet.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {weekData.map(w => (
                <BarRow key={w.weekStart} label={w.weekStart} count={w.count} max={maxWeekCount} color="#3b82f6" />
              ))}
            </div>
          )}
        </div>
```

with:

```tsx
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
            Views by Week{weekData.length > 0 && <span className="normal-case font-normal text-gray-600"> — {formatWeekRange(weekData)}</span>}
          </p>
          {weekData.length === 0 ? (
            <p className="text-xs text-gray-600">No posted content yet.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {weekData.map(w => (
                <BarRow key={w.weekStart} label={w.weekStart} count={w.views} max={maxWeekViews} color="#3b82f6" />
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Analytics.tsx
git commit -m "feat: replace Idea Velocity with views-by-week on Analytics"
```

---

### Task 8: Full verification and push

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 13 new `chartData` tests added in Tasks 1-4.

- [ ] **Step 2: Full typecheck + build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both complete with no errors.

- [ ] **Step 3: Manual browser verification**

Run: `npm run dev`, open the app in the Browser pane at the printed localhost URL.

Check:
- Dashboard: "Last 30 Days" streak grid renders (30 small squares, green where a post's `posted_at` falls on that NY-calendar day — cross-check a couple of known dates like 2026-08-04 against the 65 real `TRACKED` posts).
- Dashboard: "By Pillar (Views)" now shows view totals per pillar, not idea counts (bars should look very different from before — training/mindset should dominate given the real data skew).
- Dashboard: "Total Reach" and "Avg Engagement Rate" tiles appear in the Lifetime stats grid with real non-zero numbers (61/65 tracked posts have synced Metricool data as of 2026-08-05).
- Analytics: "Views by Week" replaces "Idea Velocity", still shows the date-range subtitle, bars now reflect view totals per week.

Check the browser console and network tab for errors.

- [ ] **Step 4: Code review gate (before push)**

This branch touches user-facing dashboard behavior across 2 pages + 4 new pure functions — above the "trivial one-liner" bar that skipped review on the two earlier same-day fixes (posting-cadence retiming, prayer-sync). Ask Carl via `AskUserQuestion` which review depth to run **before pushing**: Claude-only `/code-review`, or Claude+Codex layered (per `reference-risk-tier-dual-control` memory — this is a medium-risk personal-app UI change, not touching money/security/PII, so Claude-only is the reasonable default to lead with, but the choice is Carl's).

- [ ] **Step 5: Run the chosen review, fix any real findings, then push**

```bash
git push origin master
```
