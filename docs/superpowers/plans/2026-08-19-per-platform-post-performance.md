# Per-Platform Post Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make "posted" authoritative per-platform instead of shared. Today a `both`-platform `content_ideas` row has two post URLs (`post_url` for TikTok, `post_url_instagram` for Instagram) but one shared `views`/`likes`/`shares`/`saves`/`metricool_*` set — so a near-mirrored TikTok/Instagram post can't teach anything platform-specific, and the weekly Metricool sync actually overwrites one network's stats with the other's on every `both` post. This plan replaces the shared columns with a `content_post_performance` table (one row per idea × platform, with its own URL, timestamp, and metrics) and updates every reader/writer across three codebases and two scheduled-task prompts.

**Architecture:** New Supabase table `content_post_performance`, FK'd to `content_ideas`, unique per `(content_idea_id, platform)`. `content_ideas` keeps `platform` (the intended/planned platform(s)) and its own `posted_at`/`status` (pipeline-level, unchanged) but loses `post_url`, `post_url_instagram`, `views`, `likes`, `shares`, `saves`, and all `metricool_*` columns. Every current reader of those columns is updated to read from the new table instead.

**Tech Stack:** Supabase (Postgres + RLS), React/TypeScript (Content Manager, Jarvis UI), Express/TypeScript (Jarvis API), Node scripts (`creator-intelligence`), Claude Code scheduled-task prompts (`nightly-ops`, `sunday-ops`).

**Confirmed before writing this plan (2026-08-19, via Supabase MCP against the live `content` project, `vikpcejlyxieguorwysf`):**
- 80 `both`-platform ideas exist; only **1** has any metric populated, and it's TikTok-only (`views: 359, likes: 26, shares: 0`, `post_url_instagram: null`). Zero `both` rows have both URLs filled. **No historical shared-metric data needs an honest "can't split this" call — the migration below is a clean mechanical reshape, not a judgment call about stale data.**
- `content_ideas` RLS: single policy `owner full access to content_ideas`, `authenticated` role, `USING/WITH CHECK coaching_is_owner()`. The new table gets the identical policy.
- 132 total `POSTED`/`TRACKED` rows, 280 rows total.

**Cross-system inventory (why this spans 3 repos + 2 scheduled prompts):**
1. `C:\Users\gregm\content` (Content Manager) — the schema's home repo, plus the UI that edits/displays these fields.
2. `G:\My Drive\Claude\jarvis` — `logContentPost` (voice/chat "mark posted" tool), `content-manager.ts` (best-performer query for Jarvis dashboard), `dashboard.ts`/`ContentPage.tsx` (thin callers, no direct column references).
3. `C:\Users\gregm\creator-intelligence\match-metricool-posts.js` — matches Metricool's per-post rows to `content_ideas` by URL-embedded ID. **Already emits `network` per match — no code change needed here**, confirmed by reading it.
4. `C:\Users\gregm\.claude\scheduled-tasks\nightly-ops\SKILL.md` — nightly `yt-dlp` TikTok scraper, writes `views`/`likes`/`shares` keyed by `post_url`.
5. `C:\Users\gregm\.claude\scheduled-tasks\sunday-ops\SKILL.md` — weekly Metricool sync + analysis (hook grading, caption/hashtag correlation, vault note regeneration). Already tries to bucket "posts on the same platform" for hook grading — using `content_ideas.platform` (which includes the fake `'both'` bucket), not a real per-post network. This plan's Phase 4 fixes that bucketing as a side effect of using the real per-platform table.

---

## Phase 1 — Schema + Content Manager (ships working end-to-end on its own)

### Task 1: Create `content_post_performance` table

No migration files exist in this repo (schema changes are applied directly via the Supabase MCP `apply_migration` tool, per the existing 70+ migration history — confirmed via `list_migrations`). Do the same here.

- [x] **Step 1: Apply the migration**

Call `mcp__<supabase-mcp>__apply_migration` with `project_id: "vikpcejlyxieguorwysf"`, `name: "create_content_post_performance"`, `query`:

```sql
create table content_post_performance (
  id uuid primary key default gen_random_uuid(),
  content_idea_id uuid not null references content_ideas(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  post_url text,
  posted_at timestamptz,
  views integer,
  likes integer,
  shares integer,
  saves integer,
  metricool_reach integer,
  metricool_engagement_rate numeric,
  metricool_comments integer,
  metricool_3s_retention_pct numeric,
  metricool_watch_through_ratio numeric,
  metricool_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (content_idea_id, platform),
  unique (post_url)
);

alter table content_post_performance enable row level security;

create policy "owner full access to content_post_performance"
  on content_post_performance
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());
```

- [x] **Step 2: Verify**

Run: `mcp__<supabase-mcp>__execute_sql` with `project_id: "vikpcejlyxieguorwysf"`, query:
```sql
select count(*) from content_post_performance;
```
Expected: `0` (table exists, empty).

### Task 2: Backfill existing data, then drop the old columns

This is the one irreversible step in Phase 1 — do it as two separate migrations so a mistake in the backfill doesn't also destroy the source columns.

- [x] **Step 1: Backfill migration**

Apply migration `backfill_content_post_performance`:

```sql
-- Single-platform ideas: their one post_url/metric set maps directly.
insert into content_post_performance
  (content_idea_id, platform, post_url, posted_at, views, likes, shares, saves,
   metricool_reach, metricool_engagement_rate, metricool_comments,
   metricool_3s_retention_pct, metricool_watch_through_ratio, metricool_synced_at)
select id, platform, post_url, posted_at, views, likes, shares, saves,
       metricool_reach, metricool_engagement_rate, metricool_comments,
       metricool_3s_retention_pct, metricool_watch_through_ratio, metricool_synced_at
from content_ideas
where platform in ('tiktok', 'instagram') and post_url is not null;

-- 'both'-platform ideas: split by the existing column-ownership rule
-- (views/likes/shares are TikTok-scraper-owned; saves + metricool_* are
-- Instagram-Metricool-owned per sunday-ops's documented convention) —
-- this is not a guess, it's the ownership rule already enforced by the
-- sync jobs today.
insert into content_post_performance (content_idea_id, platform, post_url, posted_at, views, likes, shares)
select id, 'tiktok', post_url, posted_at, views, likes, shares
from content_ideas
where platform = 'both' and post_url is not null;

insert into content_post_performance
  (content_idea_id, platform, post_url, posted_at, saves,
   metricool_reach, metricool_engagement_rate, metricool_comments,
   metricool_3s_retention_pct, metricool_watch_through_ratio, metricool_synced_at)
select id, 'instagram', post_url_instagram, posted_at, saves,
       metricool_reach, metricool_engagement_rate, metricool_comments,
       metricool_3s_retention_pct, metricool_watch_through_ratio, metricool_synced_at
from content_ideas
where platform = 'both' and post_url_instagram is not null;
```

- [x] **Step 2: Verify counts**

Run:
```sql
select
  (select count(*) from content_ideas where platform in ('tiktok','instagram') and post_url is not null) as expect_single,
  (select count(*) from content_ideas where platform = 'both' and post_url is not null) as expect_both_tiktok,
  (select count(*) from content_ideas where platform = 'both' and post_url_instagram is not null) as expect_both_ig,
  (select count(*) from content_post_performance where platform = 'tiktok') as got_tiktok,
  (select count(*) from content_post_performance where platform = 'instagram') as got_instagram;
```
Expected: `expect_single + expect_both_tiktok = got_tiktok` and `expect_both_ig = got_instagram`. Given the confirmed data (80 `both` rows, 1 with data, TikTok-only, no IG url), `got_instagram` from the `both` split should be `0` and `got_tiktok` should include that 1 row.

- [x] **Step 3: Spot-check the one real row**

```sql
select p.platform, p.views, p.likes, p.shares, p.post_url
from content_post_performance p
join content_ideas i on i.id = p.content_idea_id
where i.title = '9-year transformation reel (fat → skinny → now)';
```
Expected: one row, `platform = 'tiktok'`, `views = 359`, `likes = 26`, `shares = 0`.

- [x] **Step 4: Drop the old columns — hold until Tasks 3–8 are deployed and verified working against the new table**

This step is listed here for sequencing clarity but its migration is the last step of Task 8, not this task — dropping columns the still-shipping app code reads would break production between commits.

### Task 3: `src/types/content.ts` — new types, drop old fields

**Files:**
- Modify: `src/types/content.ts`

- [x] **Step 1: Edit the file**

Remove `post_url`, `post_url_instagram`, `views`, `likes`, `shares`, `saves`, `metricool_reach`, `metricool_engagement_rate`, `metricool_comments`, `metricool_synced_at` from `ContentIdea`. (Note: `metricool_3s_retention_pct` and `metricool_watch_through_ratio` are referenced in some test fixtures but were never added to this type — that's a pre-existing inconsistency, not something to fix here; they simply don't exist on `ContentIdea` and won't exist on the new `PostPerformance` type's `content.ts` declaration either until this task adds them for real.)

Add:

```ts
export type PostPlatform = 'tiktok' | 'instagram'

export type PostPerformance = {
  id: string
  content_idea_id: string
  platform: PostPlatform
  post_url: string | null
  posted_at: string | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  metricool_reach: number | null
  metricool_engagement_rate: number | null
  metricool_comments: number | null
  metricool_3s_retention_pct: number | null
  metricool_watch_through_ratio: number | null
  metricool_synced_at: string | null
  created_at: string
}

export type NewPostPerformance = Omit<PostPerformance, 'id' | 'created_at'>

export type ContentIdeaWithPerformance = ContentIdea & { performances: PostPerformance[] }
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck` (or `tsc --noEmit` if no dedicated script — check `package.json`).
Expected: FAIL — every file still referencing the removed fields errors. That's the worklist for the remaining tasks in this phase.

### Task 4: `src/hooks/useIdeas.tsx` — fetch + join performance rows, add save method

**Files:**
- Modify: `src/hooks/useIdeas.tsx`

- [x] **Step 1: Rewrite the file**

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContentIdea, NewContentIdea, ContentIdeaWithPerformance, PostPerformance, NewPostPerformance } from '@/types/content'

interface IdeasContextValue {
  ideas: ContentIdeaWithPerformance[]
  loading: boolean
  error: string | null
  add: (idea: NewContentIdea) => Promise<ContentIdea>
  update: (id: string, changes: Partial<ContentIdea>) => Promise<void>
  remove: (id: string) => Promise<void>
  savePerformance: (contentIdeaId: string, platform: PostPerformance['platform'], changes: Partial<NewPostPerformance>) => Promise<void>
  refresh: () => Promise<void>
}

const IdeasContext = createContext<IdeasContextValue | null>(null)

function joinPerformances(ideas: ContentIdea[], performances: PostPerformance[]): ContentIdeaWithPerformance[] {
  const byIdea = new Map<string, PostPerformance[]>()
  for (const p of performances) {
    const list = byIdea.get(p.content_idea_id) ?? []
    list.push(p)
    byIdea.set(p.content_idea_id, list)
  }
  return ideas.map(i => ({ ...i, performances: byIdea.get(i.id) ?? [] }))
}

export function IdeasProvider({ children }: { children: ReactNode }) {
  const [ideas, setIdeas] = useState<ContentIdeaWithPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [ideasRes, perfRes] = await Promise.all([
      supabase.from('content_ideas').select('*').order('created_at', { ascending: false }),
      supabase.from('content_post_performance').select('*'),
    ])
    if (ideasRes.error) setError(ideasRes.error.message)
    else if (perfRes.error) setError(perfRes.error.message)
    else setIdeas(joinPerformances((ideasRes.data as ContentIdea[]) ?? [], (perfRes.data as PostPerformance[]) ?? []))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('content_ideas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_ideas' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_post_performance' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load])

  const add = async (idea: NewContentIdea) => {
    const { data, error } = await supabase.from('content_ideas').insert(idea).select().single()
    if (error) throw error
    setIdeas(prev => [{ ...(data as ContentIdea), performances: [] }, ...prev])
    return data as ContentIdea
  }

  const update = async (id: string, changes: Partial<ContentIdea>) => {
    const { error } = await supabase.from('content_ideas').update(changes).eq('id', id)
    if (error) throw error
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i))
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('content_ideas').delete().eq('id', id)
    if (error) throw error
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  const savePerformance = async (contentIdeaId: string, platform: PostPerformance['platform'], changes: Partial<NewPostPerformance>) => {
    const { data, error } = await supabase
      .from('content_post_performance')
      .upsert({ content_idea_id: contentIdeaId, platform, ...changes }, { onConflict: 'content_idea_id,platform' })
      .select()
      .single()
    if (error) throw error
    const saved = data as PostPerformance
    setIdeas(prev => prev.map(i => i.id !== contentIdeaId ? i : {
      ...i,
      performances: [...i.performances.filter(p => p.platform !== platform), saved],
    }))
  }

  const value: IdeasContextValue = { ideas, loading, error, add, update, remove, savePerformance, refresh: load }
  return <IdeasContext.Provider value={value}>{children}</IdeasContext.Provider>
}

export function useIdeas(): IdeasContextValue {
  const ctx = useContext(IdeasContext)
  if (!ctx) throw new Error('useIdeas must be used within an IdeasProvider')
  return ctx
}
```

- [x] **Step 2: Commit**

```bash
git add src/types/content.ts src/hooks/useIdeas.tsx
git commit -m "feat: add PostPerformance type and join performance rows into ideas"
```

### Task 5: `src/lib/chartData.ts` — reshape around per-platform performance

**Files:**
- Modify: `src/lib/chartData.ts`
- Test: `src/__tests__/chartData.test.ts`

Read the current file in full first (`src/lib/chartData.ts`) — this task changes every function that reads `views`/`likes`/`shares`/`saves`/`metricool_*` from `ContentIdea` directly to instead flatten `(idea, performance)` pairs across `ContentIdeaWithPerformance[]`, so a `both`-platform idea contributes two independent data points instead of one blended one. That flattening is the actual point of this whole change — a mirrored TikTok/IG post now shows up as two rows in every chart, not one.

- [x] **Step 1: Write the failing tests**

Replace the fixture and the affected `describe` blocks in `src/__tests__/chartData.test.ts`. Update `makeIdea` to build a `ContentIdeaWithPerformance` (drop the removed fields, add `performances: []` default), and add a `makePerformance` helper:

```ts
function makePerformance(overrides: Partial<PostPerformance> = {}): PostPerformance {
  return {
    id: 'perf-1', content_idea_id: 'idea-1', platform: 'tiktok', post_url: null, posted_at: null,
    views: null, likes: null, shares: null, saves: null,
    metricool_reach: null, metricool_engagement_rate: null, metricool_comments: null,
    metricool_3s_retention_pct: null, metricool_watch_through_ratio: null, metricool_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
```

Update `sumViewsByPillar`'s tests so a `both`-platform idea with two performance rows contributes both:

```ts
it('sums views per pillar across all performance rows, both-platform ideas counting twice', () => {
  const ideas = [
    makeIdea({ id: 'a', pillar: 'training', status: 'TRACKED', platform: 'both', performances: [
      makePerformance({ platform: 'tiktok', views: 100 }),
      makePerformance({ platform: 'instagram', views: 40 }),
    ] }),
    makeIdea({ id: 'b', pillar: 'training', status: 'TRACKED', platform: 'tiktok', performances: [
      makePerformance({ platform: 'tiktok', views: 50 }),
    ] }),
  ]
  const result = sumViewsByPillar(ideas)
  expect(result.find(r => r.pillar === 'training')?.views).toBe(190)
})
```

Apply the equivalent reshape to `sumViewsByWeek` (bucket by each performance row's own `posted_at`, not the idea's), `getTopPerformer`/`getTopNByViews` (rank individual `(idea, performance)` pairs, returning enough to identify both the idea and which platform won), and `metricoolTotals` (sum `metricool_reach`/average `metricool_engagement_rate` across performance rows, not ideas).

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- chartData`
Expected: FAIL — functions still read the old `ContentIdea` fields directly, or don't compile.

- [x] **Step 3: Rewrite `chartData.ts`**

```ts
import type { ContentIdeaWithPerformance, Pillar, PillarConfig, PostPerformance, PipelineStatus } from '@/types/content'
import { PILLARS } from './constants'

type IdeaPerf = { idea: ContentIdeaWithPerformance; perf: PostPerformance }

function flattenPerformances(ideas: ContentIdeaWithPerformance[]): IdeaPerf[] {
  return ideas.flatMap(idea => idea.performances.map(perf => ({ idea, perf })))
}

export function sumViewsByPillar(ideas: ContentIdeaWithPerformance[]): { pillar: Pillar; label: string; views: number }[] {
  const tracked = flattenPerformances(ideas.filter(i => i.status === 'TRACKED'))
  return PILLARS.map(p => ({
    pillar: p.value,
    label: p.label,
    views: tracked.filter(({ idea }) => idea.pillar === p.value).reduce((sum, { perf }) => sum + (perf.views ?? 0), 0),
  }))
}

// ... sumViewsByWeek, getTopPerformer, getTopNByViews, metricoolTotals: same
// flattenPerformances(...) approach, bucketing/ranking on `perf` fields and
// `perf.posted_at` instead of `idea.views` / `idea.posted_at`. Keep every
// other function in this file (countByStage, countByPillar, etc.) unchanged
// -- they operate on idea.status/pillar, not performance fields.
```

Port the remaining logic 1:1 from the current implementations, swapping `idea.<field>` for `perf.<field>` and `ideas.filter(...)` for `flattenPerformances(ideas.filter(...))`. `getTopPerformer`/`getTopNByViews` should return `{ idea, perf }` pairs (or a flattened shape callers can display, e.g. `{ ideaId, title, platform, views }`) — check `SpotlightCard.tsx` (Task 6) for what shape it actually needs before deciding the exact return type.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- chartData`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/chartData.ts src/__tests__/chartData.test.ts
git commit -m "feat: reshape chartData around per-platform performance rows"
```

### Task 6: `src/pages/Analytics.tsx` — per-platform edit UI

**Files:**
- Modify: `src/pages/Analytics.tsx`

- [x] **Step 1: Replace the single metrics block with one block per platform**

Replace the `posted.map(idea => ...)` body (lines 99–173 in the current file) so it renders one card per `(idea, platform)` pair instead of one card per idea. For each idea, the platforms to show are: `idea.platform === 'both' ? ['tiktok', 'instagram'] : [idea.platform]`. For each platform, find `idea.performances.find(p => p.platform === platform)` (may be `undefined` if never saved yet) and edit a local `draft` keyed by `` `${idea.id}:${platform}` ``.

```tsx
{posted.map(idea => {
  const platforms: Platform2[] = idea.platform === 'both' ? ['tiktok', 'instagram'] : [idea.platform as Platform2]
  return (
    <div key={idea.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <PillarBadge pillar={idea.pillar} />
        <p className="text-sm font-medium text-gray-900">{idea.title}</p>
      </div>
      {platforms.map(platform => {
        const existing = idea.performances.find(p => p.platform === platform)
        const draftKey = `${idea.id}:${platform}`
        const draft = editing[draftKey] ?? {}
        const isEditing = !!editing[draftKey]
        return (
          <div key={platform} className="border border-border rounded-lg p-3 flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{platform}</p>
            <input
              type="url"
              placeholder={platform === 'tiktok' ? 'https://www.tiktok.com/@you/video/...' : 'https://www.instagram.com/reel/...'}
              className="bg-surface border border-border rounded px-2 py-1 text-sm text-gray-900 w-full"
              value={draft.post_url ?? existing?.post_url ?? ''}
              onChange={e => setEditing(prev => ({ ...prev, [draftKey]: { ...(prev[draftKey] ?? {}), post_url: e.target.value || null } }))}
            />
            <div className="grid grid-cols-4 gap-3">
              {METRICS.map(m => (
                <div key={m} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">{m}</label>
                  <input
                    type="number"
                    min={0}
                    className="bg-surface border border-border rounded px-2 py-1 text-sm text-gray-900 w-full"
                    value={(draft as Record<string, number | null | undefined>)[m] ?? (existing?.[m] as number | null) ?? ''}
                    onChange={e => setEditing(prev => ({ ...prev, [draftKey]: { ...(prev[draftKey] ?? {}), [m]: Number(e.target.value) } }))}
                  />
                </div>
              ))}
            </div>
            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSave(idea.id, platform)}
                  className="bg-accent text-white text-xs rounded px-3 py-1"
                >
                  Save + Mark Tracked
                </button>
                <button onClick={() => handleCancel(draftKey)} className="bg-surface border border-border text-gray-500 text-xs rounded px-3 py-1">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})}
```

`handleSave`/`handleCancel`/`editing` state are now keyed by `` `${ideaId}:${platform}` `` string, not bare idea id:

```tsx
const { ideas, loading, update, savePerformance } = useIdeas()
const [editing, setEditing] = useState<Record<string, Partial<PostPerformance>>>({})

const handleSave = async (ideaId: string, platform: PostPerformance['platform']) => {
  const draftKey = `${ideaId}:${platform}`
  const changes = editing[draftKey]
  if (!changes) return
  await savePerformance(ideaId, platform, { ...changes, posted_at: changes.posted_at ?? new Date().toISOString() })
  await update(ideaId, { status: 'TRACKED' })
  setEditing(prev => { const next = { ...prev }; delete next[draftKey]; return next })
}

const handleCancel = (draftKey: string) => {
  setEditing(prev => { const next = { ...prev }; delete next[draftKey]; return next })
}
```

`type Platform2 = 'tiktok' | 'instagram'` (or import `PostPlatform` from `@/types/content` and use that name throughout instead — prefer the import, this inline alias is just to show the type shape needed).

- [x] **Step 2: Manual verify**

Run the app (`npm run dev`), open Analytics, confirm a `both`-platform posted idea renders two independent metric blocks, and saving one platform's metrics doesn't touch the other's.

- [x] **Step 3: Commit**

```bash
git add src/pages/Analytics.tsx
git commit -m "feat: edit post performance per platform in Analytics"
```

### Task 7: `src/components/SpotlightCard.tsx` and `src/components/IdeaCard.tsx` — update to the joined type

**Files:**
- Modify: `src/components/SpotlightCard.tsx`
- Modify: `src/components/IdeaCard.tsx` (only if it references removed fields — re-check after Task 3's typecheck fails point here; as read during planning it only reads `idea_score`/`execution_score`/`predicted_score`/`platform`/`status`, none of which move, so it likely needs no change beyond its prop type accepting `ContentIdeaWithPerformance`)

- [x] **Step 1: Read what `getTopPerformer` now returns (Task 5) and update `SpotlightCard.tsx`'s props/render to match — display the winning platform alongside the idea title (e.g. "🏆 TikTok — 5,000 views") instead of a bare view count.**

- [x] **Step 2: Update `IdeaCard.tsx`'s `Props.idea` type to `ContentIdeaWithPerformance`** (it's passed the joined objects from `Ideas.tsx` now) — no render changes expected.

- [x] **Step 3: Commit**

```bash
git add src/components/SpotlightCard.tsx src/components/IdeaCard.tsx
git commit -m "feat: update SpotlightCard and IdeaCard for per-platform performance"
```

### Task 8: Fix remaining typecheck/test failures, then drop the old columns

**Files:**
- Modify: `src/pages/Ideas.tsx`, `src/pages/Intel.tsx`, `src/pages/Dashboard.tsx` (remove the now-nonexistent field initializers listed at content.ts's old shape — `views: null, likes: null, shares: null, saves: null, post_url: null, post_url_instagram: null, metricool_*: null` — from the two `NewContentIdea` object literals in `Ideas.tsx`/`Intel.tsx`; update `Dashboard.tsx`'s calls into `chartData.ts` for the new return shapes from Task 5)
- Modify: `src/__tests__/*.test.ts(x)` (all six test files listed in the inventory below — update fixtures to the new `ContentIdeaWithPerformance` shape)

- [x] **Step 1: Run the full typecheck + test suite, fix every remaining error**

Run: `npm run typecheck && npm test`

Work through failures file by file. Every failure at this point is one of: (a) a `NewContentIdea`/fixture object literal still setting a removed field — delete that line; (b) a fixture missing the new `performances: []` field — add it; (c) a component still reading `idea.views` etc. directly — route it through `idea.performances` instead.

Files known (from the pre-plan grep) to need fixture updates: `src/__tests__/IdeaDetailModal.test.tsx`, `src/__tests__/IdeaCard.test.tsx`, `src/__tests__/SpotlightCard.test.tsx`, `src/__tests__/PillarStageBreakdown.test.tsx`, `src/__tests__/hookGate.test.ts`, `src/__tests__/chartData.test.ts` (already handled in Task 5).

- [x] **Step 2: Expected**

`npm run typecheck` and `npm test` both PASS with zero references to the ten removed `ContentIdea` fields anywhere in `src/`. Confirm with:

Run: `grep -rn "\.views\b\|\.likes\b\|\.shares\b\|\.saves\b\|\.post_url\b\|\.post_url_instagram\b\|\.metricool_reach\b\|\.metricool_engagement_rate\b\|\.metricool_comments\b\|\.metricool_synced_at\b" src/ --include=*.ts --include=*.tsx`
Expected: no matches outside `src/types/content.ts`'s new `PostPerformance` type and `src/hooks/useIdeas.tsx`'s join logic.

- [x] **Step 3: Commit the fixture/cleanup changes**

```bash
git add -A
git commit -m "fix: update remaining fixtures and pages for per-platform performance"
```

- [x] **Step 4: Deploy and manually verify in production** (Vercel auto-deploys on push to `master`, or push a branch and open the PR preview — Carl's call which). Confirm Analytics/Dashboard/Ideas pages load with real data and the per-platform metric blocks work.

- [x] **Step 5: Drop the old columns (the irreversible step deferred from Task 2)**

Once Step 4 is confirmed working, apply migration `drop_content_ideas_performance_columns`:

```sql
alter table content_ideas
  drop column post_url,
  drop column post_url_instagram,
  drop column views,
  drop column likes,
  drop column shares,
  drop column saves,
  drop column metricool_reach,
  drop column metricool_engagement_rate,
  drop column metricool_comments,
  drop column metricool_3s_retention_pct,
  drop column metricool_watch_through_ratio,
  drop column metricool_synced_at;
```

**Phase 1 is now shippable and complete on its own.** Phases 2–4 update the other writers/readers, which until they land will simply stop writing real data (Jarvis's `logContentPost`/`content-manager.ts` will error on the dropped columns — see Phase 2's urgency note below; the two scheduled prompts will silently no-op since their `UPDATE ... WHERE post_url = ...` targets a column that no longer exists on `content_ideas`).

**Sequencing note:** because Task 8 Step 5 drops columns Phase 2's code still references, land Phase 2 (small, ~4 files) in the same session immediately after Phase 1, before Carl next uses Jarvis's "mark posted" voice command or before the next `nightly-ops`/`sunday-ops` run. Phases 3–4 are lower urgency (they degrade to a logged no-op, not a crash) but shouldn't sit unshipped for more than the current week's `sunday-ops` run.

---

## Phase 2 — Jarvis (small, land immediately after Phase 1 to avoid a broken "mark posted" tool)

### Task 9: `src/tools/logContentPost.ts` — write to `content_post_performance`

**Files:**
- Modify: `G:\My Drive\Claude\jarvis\src\tools\logContentPost.ts`

- [x] **Step 1: Rewrite**

```ts
import { getSupabase } from '../db/supabase.js'

type FoundRow = { id: string; title: string; platform: 'tiktok' | 'instagram' | 'both' }

export async function logContentPost(input: {
  title_search: string
  post_url?: string
  platform?: 'tiktok' | 'instagram'
  views?: number
  likes?: number
  shares?: number
  saves?: number
}): Promise<string> {
  const supa = getSupabase()
  const { data: found } = await supa
    .from('content_ideas')
    .select('id, title, platform')
    .ilike('title', `%${input.title_search}%`)
    .neq('status', 'TRACKED')
    .limit(1)
    .single()

  if (!found) return `No untracked idea found matching "${input.title_search}".`

  const row = found as FoundRow
  const hasMetrics = input.views !== undefined || input.likes !== undefined
  // Defaults to 'tiktok' -- this tool has always been the TikTok-scraper's
  // upstream trigger in practice (see nightly-ops' scraper, which requires
  // this tool to have captured post_url first). An explicit platform wins
  // when the caller knows better (e.g. logging an Instagram-only post).
  const platform = input.platform ?? (row.platform === 'instagram' ? 'instagram' : 'tiktok')
  const posted_at = new Date().toISOString()

  const perfUpdates: Record<string, unknown> = { content_idea_id: row.id, platform, posted_at }
  if (input.post_url !== undefined) perfUpdates.post_url = input.post_url
  if (input.views !== undefined) perfUpdates.views = input.views
  if (input.likes !== undefined) perfUpdates.likes = input.likes
  if (input.shares !== undefined) perfUpdates.shares = input.shares
  if (input.saves !== undefined) perfUpdates.saves = input.saves

  await supa.from('content_post_performance').upsert(perfUpdates, { onConflict: 'content_idea_id,platform' })
  await supa.from('content_ideas').update({ status: hasMetrics ? 'TRACKED' : 'POSTED', posted_at }).eq('id', row.id)

  return hasMetrics
    ? `Logged "${row.title}" (${platform}) as TRACKED — ${input.views ?? 0} views, ${input.likes ?? 0} likes, ${input.shares ?? 0} shares`
    : `Logged "${row.title}" (${platform}) as POSTED. Update metrics later via Analytics tab.`
}
```

- [x] **Step 2: Update the test**

Find and update `logContentPost`'s test (search `G:\My Drive\Claude\jarvis\tests` for `logContentPost`) to assert against `content_post_performance` upserts instead of `content_ideas` field updates. Mirror the existing test's mock-Supabase pattern.

- [x] **Step 3: Run tests**

Run: `npm test -- logContentPost` (from `G:\My Drive\Claude\jarvis`)
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/tools/logContentPost.ts tests/tools/logContentPost.test.ts
git commit -m "fix: write logged posts to content_post_performance, not shared columns"
```

### Task 10: `src/tools/content-manager.ts` — `getTopPostViews` reads the new table

**Files:**
- Modify: `G:\My Drive\Claude\jarvis\src\tools\content-manager.ts`
- Test: `G:\My Drive\Claude\jarvis\tests\tools\content-manager.test.ts`

- [x] **Step 1: Update `getTopPostViews`**

```ts
async function getTopPostViews(): Promise<number | null | 'unknown'> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data, error } = await getSupabase()
      .from('content_post_performance')
      .select('views')
      .not('post_url', 'is', null)
      .gte('posted_at', sevenDaysAgo)
      .order('views', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const row = data as { views: number } | null
    return row ? row.views : null
  } catch {
    return 'unknown'
  }
}
```

`getDaysSinceLastPost` is unchanged — it reads `content_ideas.posted_at`, which stays on `content_ideas` (idea-level pipeline timestamp, not touched by this migration).

- [x] **Step 2: Update the test's mock table target from `content_ideas` to `content_post_performance` for the `getTopPostViews` cases specifically** (leave `getDaysSinceLastPost`/`getStatusCounts`/`getLatestTakeaway` cases as-is).

- [x] **Step 3: Run tests**

Run: `npm test -- content-manager`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/tools/content-manager.ts tests/tools/content-manager.test.ts
git commit -m "fix: getTopPostViews reads content_post_performance"
```

### Task 11: Confirm no other Jarvis references

**Files:** none modified — verification only.

- [x] **Step 1: Grep the whole Jarvis repo for the dropped columns**

Run (from `G:\My Drive\Claude\jarvis`): `grep -rn "\.post_url\b\|\.views\b\|\.likes\b\|\.shares\b\|\.saves\b\|metricool_reach\|metricool_engagement_rate\|metricool_comments\|metricool_synced_at" src/ ui/src/ --include=*.ts --include=*.tsx`

Expected: only matches inside `logContentPost.ts`/`content-manager.ts` (already updated) and `ContentPage.tsx`'s `topViews`/`postUrl` variables, which are local UI state names, not column references — read the matches to confirm before assuming this is clean; `dashboard.ts`'s route handlers pass through `getTopPostViews`'s return value unchanged and need no edit.

- [x] **Step 2: If Step 1 finds anything unexpected, add a task here and handle it before moving to Phase 3.**

---

## Phase 3 — `creator-intelligence` matcher + `nightly-ops` TikTok scraper

### Task 12: Confirm `match-metricool-posts.js` needs no change

**Files:** none modified — verification only.

- [x] **Step 1: Re-read `C:\Users\gregm\creator-intelligence\match-metricool-posts.js`**

Confirm `matchMetricoolPosts` already returns `{ matched: [{ contentIdeaId, postId, metrics, network }], ambiguous, unmatched }` — `network` (`'tiktok'`/`'instagram'`) is already present per match, which is exactly what Phase 4's write-back needs. No code change required; this task exists so the plan's execution doesn't skip verifying that assumption before Phase 4 depends on it.

### Task 13: `nightly-ops` TikTok scraper — write to `content_post_performance`

**Files:**
- Modify: `C:\Users\gregm\.claude\scheduled-tasks\nightly-ops\SKILL.md`

- [x] **Step 1: Read the current scraper section in full** (search the file for "yt-dlp"/"tiktok-performance-sync" — the section around line 156–165 found during planning) to get its exact current query/write logic before editing.

- [x] **Step 2: Change the write-back**

The scraper currently does something like `UPDATE content_ideas SET views = ?, likes = ?, shares = ? WHERE post_url = ?`. Change it to:

```sql
UPDATE content_post_performance
SET views = ?, likes = ?, shares = ?
WHERE post_url = ? AND platform = 'tiktok';
```

Since `post_url` no longer lives on `content_ideas` after Phase 1, the scraper's row-discovery query (currently something like `SELECT id, post_url FROM content_ideas WHERE status IN ('POSTED','TRACKED') AND post_url IS NOT NULL`) must change to:

```sql
SELECT p.id, p.post_url
FROM content_post_performance p
JOIN content_ideas i ON i.id = p.content_idea_id
WHERE i.status IN ('POSTED', 'TRACKED') AND p.platform = 'tiktok' AND p.post_url IS NOT NULL;
```

- [x] **Step 2: Update the run-log/trace text** in the same file if it names the old columns explicitly (search for "views"/"likes"/"shares" in the write-run-logs invocation near the end of the scraper section).

- [x] **Step 3: No automated test exists for a SKILL.md prompt — verify by re-reading the edited section against Step 2's SQL for internal consistency, then let the next scheduled `nightly-ops` run (or a manual trigger) be the real-world check. Note in this session's `write-run-logs` output (if triggered manually) whether the update path worked.**

---

## Phase 4 — `sunday-ops` Metricool sync + analysis

This phase edits `C:\Users\gregm\.claude\scheduled-tasks\sunday-ops\SKILL.md` (the ~300-line weekly content-performance-sync prompt read during planning). No unit tests apply to a prompt file — verification is a careful re-read plus the next real scheduled run.

### Task 14: Step 1 (find rows to sync) — query the new table

- [x] **Step 1: Replace the Step 1 query.**

Current: query `content_ideas` for `status IN ('POSTED','TRACKED')`, `post_url IS NOT NULL`, `posted_at >= now() - interval '8 days'`.

New:
```sql
SELECT p.content_idea_id, p.post_url, p.platform
FROM content_post_performance p
JOIN content_ideas i ON i.id = p.content_idea_id
WHERE i.status IN ('POSTED', 'TRACKED')
  AND p.post_url IS NOT NULL
  AND p.posted_at >= now() - interval '8 days';
```

The `contentIdeaRows` array Step 3's matcher consumes now needs both `post_url` values per idea (TikTok's and Instagram's, if both exist) the way the old shared-columns query naturally provided both in one row. Build it by grouping this query's results by `content_idea_id`: `{ id, post_url, post_url_instagram }` shaped exactly as `matchMetricoolPosts` expects (Task 12 confirmed its interface is unchanged) — i.e., reconstruct the two-URL-per-idea shape client-side from the per-platform rows, don't change `match-metricool-posts.js` itself.

### Task 15: Step 4 (write results back) — per-platform upsert

- [x] **Step 1: Replace the write-back logic.**

Current: for each `result.matched` entry, `UPDATE content_ideas SET metricool_reach=…, metricool_engagement_rate=…, metricool_comments=…, metricool_synced_at=now() WHERE id = contentIdeaId`, with the `network === 'instagram'` special cases for `metricool_3s_retention_pct` and `saves`.

New — same field-ownership rules, different target table and keyed by `(content_idea_id, network)` instead of just `content_idea_id`, which is what actually fixes the overwrite bug:

```sql
UPDATE content_post_performance
SET metricool_reach = ?, metricool_engagement_rate = ?, metricool_comments = ?, metricool_synced_at = now()
  <<+ ", metricool_3s_retention_pct = ?" if network = 'instagram' else "">>
  <<+ ", metricool_watch_through_ratio = ?" if computable for this network>>
  <<+ ", saves = ?" if network = 'instagram' AND current saves IS NULL>>
WHERE content_idea_id = ? AND platform = ?;
```

(Written as pseudocode with the existing conditional-field rules preserved verbatim — the executing agent should translate this into the same per-network branching the current Step 4 already does, just against `content_post_performance` keyed by `platform` instead of `content_ideas` keyed only by id.) Remove the "Never write to `views`/`likes`/`shares`" caveat's *reasoning* (it was there to explain why Metricool's TikTok numbers don't clobber the scraper's) — it still applies, just now enforced naturally by each network writing only its own row.

- [x] **Step 2: If no `content_post_performance` row exists yet for a matched `(content_idea_id, network)` pair** (can happen for the orphan-auto-create path — see Task 16), `UPSERT` instead of `UPDATE`, setting `post_url` from the matched post's URL too.

### Task 16: Step 3.5 (orphan auto-create) — create both rows

- [x] **Step 1: Read the current orphan-auto-create logic** (added 2026-08-19, described in the design doc's "Post-review addition" section — search the SKILL.md for "auto-create" or "orphan").

- [x] **Step 2: Update it to insert both a minimal `content_ideas` row (unchanged — title, platform, status, posted_at; drop `post_url` from this insert, it no longer belongs there) and a `content_post_performance` row** (`content_idea_id`, `platform = network`, `post_url`, `posted_at`, real metrics) in the same step, instead of one `content_ideas` insert carrying everything.

### Task 17: Step 5 (vault note regeneration + hook grading + hashtag correlation) — re-point every field reference

- [x] **Step 1: Update the "re-read all rows with real performance data" query** from `content_ideas WHERE views IS NOT NULL OR metricool_reach IS NOT NULL` to a join against `content_post_performance`, and note explicitly that each row in the regenerated note is now an **(idea, platform)** pair, not an idea — a `both`-platform post can appear twice, once per platform, which is correct and is the point of this migration.

- [x] **Step 2: Fix the hook-grading platform bucketing** (Step 5's "3+ posts on the same platform" rule, currently keyed on `content_ideas.platform` which includes the fake `'both'` bucket) to key on `content_post_performance.platform` instead — every post's real network, never `'both'`. Call this out explicitly in the edited text as a correctness fix, not just a rename: a `both`-platform idea's TikTok and Instagram performance now correctly land in the TikTok and Instagram buckets respectively, instead of both landing in an undifferentiated `'both'` bucket that couldn't be compared against pure-TikTok or pure-Instagram posts.

- [x] **Step 3: Update the caption/hashtag correlation section and the 50-post re-check flag's qualifying-row count** to the same (idea, platform) universe from Step 1 above — the caption text (`body`) is still idea-level (one caption applies to both platforms' posts when it's a mirrored `both` post), but the performance metric being correlated against it is now per-platform, so a `both`-platform post contributes two data points (same caption, two different engagement numbers) to the hashtag/caption-length buckets — which is more signal, not double-counting, since TikTok and Instagram genuinely perform differently on the same caption.

- [x] **Step 4: Update `Carl's Own Post Performance.md`'s table format** (`Carl Meyer\09 - Content & Marketing\Carl's Own Post Performance.md`) to add a Platform column if it doesn't already effectively have one (it likely already shows platform per the existing hook-grading breakdown — verify by reading the current note before assuming a format change is needed).

- [x] **Step 5: Re-read the entire edited Step 5 section for internal consistency** (field names, table references) — this is the verification step for this SKILL.md-only phase; there's no test runner for a prompt file.

---

## Self-Review Notes (from the plan-writing pass)

- **Spec coverage:** the original ask — "split into per-platform performance records with real timestamps" — is covered by the new table's `posted_at` per row (Task 1) and every writer in Phases 2–4 setting it independently per platform.
- **No fabricated backfill:** Task 2's migration only ever copies real existing values into the platform each column was already documented as belonging to (TikTok-scraper-owned vs. Instagram-Metricool-owned) — it never guesses a split for a number that was genuinely shared.
- **Sequencing risk called out explicitly:** Phase 1 Task 8 Step 5 (column drop) is sequenced after Phase 1's own deploy-and-verify, and Phase 2 is flagged as urgent-follow-on specifically because it would otherwise break silently against the dropped columns.
- **Known pre-existing inconsistency, not fixed here:** `metricool_3s_retention_pct`/`metricool_watch_through_ratio` appear in some Content Manager test fixtures today without being real `ContentIdea` fields — Task 3 makes them real (on `PostPerformance`), which incidentally resolves that drift, but it wasn't a goal of this plan.

---

## Closed out — 2026-08-19

All 4 phases shipped and merged. Deviations from the plan as written, for anyone reading this later:

- **Task 16 (Step 3.5 orphan auto-create) turned out N/A** — no standing "Step 3.5" existed in `sunday-ops`'s `SKILL.md`; the design doc's "orphan auto-create" was a one-time manual backfill, never turned into a permanent step. Nothing to update.
- **Real bugs found during review, fixed before merge:** `Analytics.tsx` was resetting `posted_at` to "now" on every re-save of an already-tracked performance row (would have corrupted `sumViewsByWeek`'s week bucketing on any later metric correction); `creator-intelligence/performance-sync.js` was silently discarding the status-flip write's error. Found via Claude inline review + an independent Codex review.
- **`content` PR hit a real merge conflict** — a separate "Experiment Queue" feature (9 commits) landed on `master` on the same files (`content.ts`, `Analytics.tsx`, `Ideas.tsx`, `Intel.tsx`) while this plan was executing. Resolved via rebase; also had to fix `src/lib/experiments.ts`'s `experimentRows`, which read `views`/`likes`/etc. directly off `ContentIdea` and needed to aggregate across the new per-platform `performances` array instead (sum counts, average engagement rate — same convention as `chartData.ts`'s `metricoolTotals`).
- **Two real gaps deliberately deferred, spawned as separate follow-up tasks rather than expanding this plan's scope:**
  1. `source_intel_insight_id` is declared on `ContentIdea` and read by `IdeaCard.tsx`/`Intel.tsx` but doesn't exist as a column on the live `content_ideas` table (pre-existing drift, unrelated to this migration, found while verifying the column-drop migration).
  2. Jarvis's `logContentPost` can never re-log a `both`-platform idea's second platform once the first flips status to `TRACKED` (the `.neq('status','TRACKED')` lookup guard blocks it) — found by Codex, directly on the seam this migration is meant to fix, but a real design decision rather than a quick patch.
- **Final state:** schema live and backfilled, all readers/writers across `content`, `jarvis`, and `creator-intelligence` updated, `nightly-ops`/`sunday-ops` scheduled-task prompts updated, all 3 PRs merged (content#1, creator-intelligence#1, claude-workspace#58), `Carl's Own Post Performance.md` already regenerated correctly off the new table (confirmed via an out-of-cycle `sunday-ops` run the same day).
