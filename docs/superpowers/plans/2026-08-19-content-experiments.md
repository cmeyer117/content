# Weekly Experiment Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Carl run one causal experiment at a time — a hypothesis, a set of tagged posts, a manual verdict — surfaced in `Analytics.tsx`.

**Architecture:** New `experiments` table (one row per hypothesis) plus a nullable `experiment_id` FK on `content_ideas`. A pure function builds display rows from tagged ideas; a plain fetch-on-mount hook (matching `useIntel.ts`'s style, no context/realtime) manages experiment CRUD; `Analytics.tsx` gets a new top section; `IdeaDetailModal` gets one checkbox to tag/untag an idea into the active experiment.

**Tech Stack:** React 19, TypeScript (strict), Supabase (`@supabase/supabase-js`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-content-experiments-design.md`

---

### Task 1: Database schema + type additions

**Files:**
- Modify: `src/types/content.ts`
- Modify: `src/__tests__/chartData.test.ts:14` (fixture)
- Modify: `src/__tests__/SpotlightCard.test.tsx:15` (fixture)
- Modify: `src/__tests__/PillarStageBreakdown.test.tsx:16` (fixture)
- Modify: `src/__tests__/IdeaDetailModal.test.tsx:42` (fixture)
- Modify: `src/__tests__/IdeaCard.test.tsx:42` (fixture)
- Modify: `src/__tests__/hookGate.test.ts:41` (fixture)
- Modify: `src/pages/Ideas.tsx:41` (`empty` NewContentIdea literal)

- [ ] **Step 1: Apply the migration to Supabase**

Project `vikpcejlyxieguorwysf` (confirmed via `list_tables` — this is the project backing `content_ideas`, RLS enabled, single policy `owner full access to content_ideas` using `coaching_is_owner()`). Apply via the connected Supabase MCP tool (`apply_migration`), matching the existing table's RLS pattern:

```sql
create table experiments (
  id uuid primary key default gen_random_uuid(),
  hypothesis text not null,
  status text not null default 'active',
  verdict text,
  created_at timestamptz not null default now()
);

alter table experiments enable row level security;

create policy "owner full access to experiments"
  on experiments
  for all
  to authenticated
  using (coaching_is_owner())
  with check (coaching_is_owner());

alter table content_ideas add column experiment_id uuid references experiments(id);
```

- [ ] **Step 2: Verify the migration**

Run `list_tables` (or `execute_sql` with `select column_name from information_schema.columns where table_name = 'experiments'`) and confirm `experiments` exists with RLS enabled and `content_ideas.experiment_id` is present.

- [ ] **Step 3: Add the `Experiment` type and `experiment_id` field**

In `src/types/content.ts`, add after `ContentClass`:

```typescript
export type ExperimentStatus = 'active' | 'concluded'

export type Experiment = {
  id: string
  hypothesis: string
  status: ExperimentStatus
  verdict: string | null
  created_at: string
}
```

Add one field to `ContentIdea`, after `source_intel_insight_id: string | null`:

```typescript
  experiment_id: string | null
```

- [ ] **Step 4: Run the build to find every fixture that now fails to typecheck**

Run: `cd C:\Users\gregm\content && npm run build`
Expected: FAIL — `Property 'experiment_id' is missing` in the 6 test fixture files and `src/pages/Ideas.tsx`'s `empty` literal.

- [ ] **Step 5: Add `experiment_id: null` to every fixture**

In each of `src/__tests__/chartData.test.ts`, `src/__tests__/SpotlightCard.test.tsx`, `src/__tests__/PillarStageBreakdown.test.tsx`, `src/__tests__/IdeaDetailModal.test.tsx`, `src/__tests__/IdeaCard.test.tsx`, `src/__tests__/hookGate.test.ts` — add `experiment_id: null,` immediately after the existing `source_intel_insight_id: null,` line.

In `src/pages/Ideas.tsx`, add `experiment_id: null,` immediately after `source_intel_insight_id: null,` in the `empty` object (currently line 22).

- [ ] **Step 6: Run the build again to confirm it passes**

Run: `cd C:\Users\gregm\content && npm run build`
Expected: PASS, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/content.ts src/pages/Ideas.tsx src/__tests__/chartData.test.ts src/__tests__/SpotlightCard.test.tsx src/__tests__/PillarStageBreakdown.test.tsx src/__tests__/IdeaDetailModal.test.tsx src/__tests__/IdeaCard.test.tsx src/__tests__/hookGate.test.ts
git commit -m "feat: add experiments table and experiment_id field"
```

---

### Task 2: Pure row-building function

**Files:**
- Create: `src/lib/experiments.ts`
- Test: `src/__tests__/experiments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/experiments.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { experimentRows } from '@/lib/experiments'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, source_intel_insight_id: null, scheduled_at: null, posted_at: null,
    views: null, likes: null, shares: null, saves: null, post_url: null, post_url_instagram: null,
    idea_score: null, idea_score_notes: null, execution_score: null, execution_score_notes: null,
    predicted_score: null, predicted_reasoning: null, predicted_at: null, prediction_version: null,
    metricool_reach: null, metricool_engagement_rate: null, metricool_comments: null,
    metricool_3s_retention_pct: null, metricool_watch_through_ratio: null, metricool_synced_at: null,
    experiment_id: null, created_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

describe('experimentRows', () => {
  it('returns an empty array when no ideas are tagged into the experiment', () => {
    const ideas = [makeIdea({ id: 'a', experiment_id: null })]
    expect(experimentRows(ideas, 'exp-1')).toEqual([])
  })

  it('includes both posted and unposted ideas tagged into the experiment', () => {
    const ideas = [
      makeIdea({ id: 'a', experiment_id: 'exp-1', status: 'IDEA', views: null }),
      makeIdea({ id: 'b', experiment_id: 'exp-1', status: 'TRACKED', views: 500 }),
    ]
    const result = experimentRows(ideas, 'exp-1')
    expect(result.map(r => r.id)).toEqual(['a', 'b'])
    expect(result[1].views).toBe(500)
  })

  it('excludes ideas tagged into a different experiment', () => {
    const ideas = [
      makeIdea({ id: 'a', experiment_id: 'exp-1' }),
      makeIdea({ id: 'b', experiment_id: 'exp-2' }),
    ]
    expect(experimentRows(ideas, 'exp-1').map(r => r.id)).toEqual(['a'])
  })

  it('carries content_class, hook, target_length_seconds, and the 4 outcome metrics plus engagement rate', () => {
    const ideas = [makeIdea({
      id: 'a', experiment_id: 'exp-1', content_class: 'technique', hook: 'Do this instead',
      target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2,
    })]
    expect(experimentRows(ideas, 'exp-1')[0]).toEqual({
      id: 'a', title: 't', content_class: 'technique', hook: 'Do this instead',
      target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2,
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/experiments.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/experiments"`

- [ ] **Step 3: Write the implementation**

Create `src/lib/experiments.ts`:

```typescript
import type { ContentIdea } from '@/types/content'

export type ExperimentRow = {
  id: string
  title: string
  content_class: ContentIdea['content_class']
  hook: string | null
  target_length_seconds: number | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  metricool_engagement_rate: number | null
}

export function experimentRows(ideas: ContentIdea[], experimentId: string): ExperimentRow[] {
  return ideas
    .filter(i => i.experiment_id === experimentId)
    .map(i => ({
      id: i.id,
      title: i.title,
      content_class: i.content_class,
      hook: i.hook,
      target_length_seconds: i.target_length_seconds,
      views: i.views,
      likes: i.likes,
      shares: i.shares,
      saves: i.saves,
      metricool_engagement_rate: i.metricool_engagement_rate,
    }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/experiments.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/experiments.ts src/__tests__/experiments.test.ts
git commit -m "feat: add experimentRows pure function"
```

---

### Task 3: `useExperiments` hook

**Files:**
- Create: `src/hooks/useExperiments.ts`
- Test: `src/__tests__/useExperiments.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/useExperiments.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useExperiments } from '@/hooks/useExperiments'

const mockInsertResult = { data: { id: 'new-1', hypothesis: 'Shorter hooks win', status: 'active', verdict: null, created_at: '2026-08-19T00:00:00Z' }, error: null }

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({
          data: [{ id: 'exp-1', hypothesis: 'Old one', status: 'concluded', verdict: 'No difference', created_at: '2026-08-01T00:00:00Z' }],
          error: null,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(mockInsertResult)),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}))

describe('useExperiments', () => {
  it('loads experiments on mount', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.experiments).toHaveLength(1)
  })

  it('exposes active as null when no experiment is active', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.active).toBeNull()
  })

  it('start() inserts a new active experiment and prepends it', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.start('Shorter hooks win') })
    expect(result.current.experiments[0].hypothesis).toBe('Shorter hooks win')
    expect(result.current.active?.id).toBe('new-1')
  })

  it('conclude() sets status to concluded and stores the verdict', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.start('Shorter hooks win') })
    await act(async () => { await result.current.conclude('new-1', 'Confirmed, cut to under 3s') })
    const concluded = result.current.experiments.find(e => e.id === 'new-1')
    expect(concluded?.status).toBe('concluded')
    expect(concluded?.verdict).toBe('Confirmed, cut to under 3s')
    expect(result.current.active).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/useExperiments.test.tsx`
Expected: FAIL — `Failed to resolve import "@/hooks/useExperiments"`

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useExperiments.ts` (plain fetch-on-mount hook, matching `useIntel.ts`'s style — no context, no realtime, since only one row is ever active and this isn't shared cross-tab state):

```typescript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Experiment } from '@/types/content'

export function useExperiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('experiments').select('*').order('created_at', { ascending: false })
    setExperiments((data as Experiment[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const start = async (hypothesis: string) => {
    const { data, error } = await supabase
      .from('experiments')
      .insert({ hypothesis, status: 'active' })
      .select()
      .single()
    if (error) throw error
    setExperiments(prev => [data as Experiment, ...prev])
    return data as Experiment
  }

  const conclude = async (id: string, verdict: string) => {
    const { error } = await supabase.from('experiments').update({ status: 'concluded', verdict }).eq('id', id)
    if (error) throw error
    setExperiments(prev => prev.map(e => e.id === id ? { ...e, status: 'concluded', verdict } : e))
  }

  const active = experiments.find(e => e.status === 'active') ?? null

  return { experiments, active, loading, start, conclude }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/useExperiments.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useExperiments.ts src/__tests__/useExperiments.test.tsx
git commit -m "feat: add useExperiments hook"
```

---

### Task 4: `ExperimentTable` presentational component

**Files:**
- Create: `src/components/ExperimentTable.tsx`
- Test: `src/__tests__/ExperimentTable.test.tsx`

Shared table markup for both the active experiment's live view and a concluded experiment's expanded view — avoids duplicating the same 9-column table in `Analytics.tsx` twice.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ExperimentTable.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExperimentTable from '@/components/ExperimentTable'
import type { ExperimentRow } from '@/lib/experiments'

const rows: ExperimentRow[] = [
  { id: 'a', title: 'How to bench more', content_class: 'technique', hook: 'Stop doing this', target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2 },
]

describe('ExperimentTable', () => {
  it('renders a row per tagged idea with its title and metrics', () => {
    render(<ExperimentTable rows={rows} />)
    expect(screen.getByText('How to bench more')).toBeTruthy()
    expect(screen.getByText('technique')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
  })

  it('shows an em dash for null fields instead of blank cells', () => {
    const nullRow: ExperimentRow = { id: 'b', title: 'Untagged draft', content_class: null, hook: null, target_length_seconds: null, views: null, likes: null, shares: null, saves: null, metricool_engagement_rate: null }
    render(<ExperimentTable rows={[nullRow]} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows an empty-state message when there are no rows', () => {
    render(<ExperimentTable rows={[]} />)
    expect(screen.getByText(/no ideas tagged/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/ExperimentTable.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ExperimentTable"`

- [ ] **Step 3: Write the implementation**

Create `src/components/ExperimentTable.tsx`:

```tsx
import type { ExperimentRow } from '@/lib/experiments'

const dash = (v: string | number | null) => v ?? '—'

export default function ExperimentTable({ rows }: { rows: ExperimentRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-600">No ideas tagged into this experiment yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-gray-500 uppercase tracking-wide">
            <th className="pr-3 py-1">Title</th>
            <th className="pr-3 py-1">Class</th>
            <th className="pr-3 py-1">Hook</th>
            <th className="pr-3 py-1">Length</th>
            <th className="pr-3 py-1">Views</th>
            <th className="pr-3 py-1">Likes</th>
            <th className="pr-3 py-1">Shares</th>
            <th className="pr-3 py-1">Saves</th>
            <th className="pr-3 py-1">Eng. Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="text-gray-900 border-t border-border">
              <td className="pr-3 py-1">{r.title}</td>
              <td className="pr-3 py-1">{dash(r.content_class)}</td>
              <td className="pr-3 py-1">{dash(r.hook)}</td>
              <td className="pr-3 py-1">{dash(r.target_length_seconds)}</td>
              <td className="pr-3 py-1">{dash(r.views)}</td>
              <td className="pr-3 py-1">{dash(r.likes)}</td>
              <td className="pr-3 py-1">{dash(r.shares)}</td>
              <td className="pr-3 py-1">{dash(r.saves)}</td>
              <td className="pr-3 py-1">{dash(r.metricool_engagement_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/ExperimentTable.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExperimentTable.tsx src/__tests__/ExperimentTable.test.tsx
git commit -m "feat: add ExperimentTable component"
```

---

### Task 5: Experiment Queue section in `Analytics.tsx`

**Files:**
- Modify: `src/pages/Analytics.tsx`

No test file exists for `Analytics.tsx` today (it's a manually-verified page like the rest of this app's pages) — this task is verified via `npm run build` + a manual run (Step 4 below), matching the existing convention.

- [ ] **Step 1: Add the imports**

At the top of `src/pages/Analytics.tsx`, add:

```typescript
import { useExperiments } from '@/hooks/useExperiments'
import { experimentRows } from '@/lib/experiments'
import ExperimentTable from '@/components/ExperimentTable'
```

- [ ] **Step 2: Add the `ExperimentQueue` section component**

Add this function above `export default function Analytics()` in `src/pages/Analytics.tsx`:

```tsx
function ExperimentQueue({ ideas }: { ideas: ContentIdea[] }) {
  const { experiments, active, loading, start, conclude } = useExperiments()
  const [hypothesis, setHypothesis] = useState('')
  const [verdict, setVerdict] = useState('')
  const [starting, setStarting] = useState(false)
  const [concluding, setConcluding] = useState(false)

  if (loading) return null

  const concludedExperiments = experiments.filter(e => e.status === 'concluded')

  const handleStart = async () => {
    if (!hypothesis.trim()) return
    setStarting(true)
    try {
      await start(hypothesis.trim())
      setHypothesis('')
    } finally {
      setStarting(false)
    }
  }

  const handleConclude = async () => {
    if (!active || !verdict.trim()) return
    setConcluding(true)
    try {
      await conclude(active.id, verdict.trim())
      setVerdict('')
    } finally {
      setConcluding(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Experiment Queue</p>

      {!active ? (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <input
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
            placeholder='Hypothesis (e.g. "technique posts outperform diary posts")'
            value={hypothesis}
            onChange={e => setHypothesis(e.target.value)}
          />
          <button
            onClick={() => void handleStart()}
            disabled={starting || !hypothesis.trim()}
            className="bg-accent text-white text-xs rounded px-3 py-1 self-start disabled:opacity-40"
          >
            {starting ? 'Starting...' : 'Start Experiment'}
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-900">{active.hypothesis}</p>
          <ExperimentTable rows={experimentRows(ideas, active.id)} />
          <textarea
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full min-h-[80px]"
            placeholder="Verdict — what did this tell you?"
            value={verdict}
            onChange={e => setVerdict(e.target.value)}
          />
          <button
            onClick={() => void handleConclude()}
            disabled={concluding || !verdict.trim()}
            className="bg-accent text-white text-xs rounded px-3 py-1 self-start disabled:opacity-40"
          >
            {concluding ? 'Concluding...' : 'Conclude Experiment'}
          </button>
        </div>
      )}

      {concludedExperiments.length > 0 && (
        <div className="flex flex-col gap-2">
          {concludedExperiments.map(e => (
            <details key={e.id} className="bg-card border border-border rounded-xl p-3">
              <summary className="text-sm font-medium text-gray-900 cursor-pointer">{e.hypothesis}</summary>
              <p className="text-xs text-gray-600 mt-2">{e.verdict}</p>
              <div className="mt-2">
                <ExperimentTable rows={experimentRows(ideas, e.id)} />
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Render it at the top of the page**

In `Analytics.tsx`'s default export, add `<ExperimentQueue ideas={ideas} />` as the first child inside the outer `<div className="flex flex-col gap-6">`, immediately after the `<h1>`:

```tsx
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <ExperimentQueue ideas={ideas} />

      {/* Pipeline Overview */}
```

- [ ] **Step 4: Verify with the build and a manual run**

Run: `cd C:\Users\gregm\content && npm run build`
Expected: PASS.

Then start the dev server (`npm run dev`) and open `/analytics` in a browser: confirm the "Experiment Queue" section renders, "Start Experiment" is disabled until text is typed, and starting one shows the (empty) table + verdict box.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Analytics.tsx
git commit -m "feat: add Experiment Queue section to Analytics"
```

---

### Task 6: Tag ideas into the active experiment

**Files:**
- Modify: `src/components/IdeaDetailModal.tsx`
- Modify: `src/pages/Ideas.tsx`
- Modify: `src/pages/Pipeline.tsx`
- Modify: `src/__tests__/IdeaDetailModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/IdeaDetailModal.test.tsx`, inside the existing `describe('IdeaDetailModal', ...)` block:

```tsx
  it('shows no experiment checkbox when there is no active experiment', () => {
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} activeExperiment={null} />)
    expect(screen.queryByText(/Part of experiment/)).toBeNull()
  })

  it('shows a checked checkbox when the idea is already tagged into the active experiment', () => {
    const active = { id: 'exp-1', hypothesis: 'Shorter hooks win', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const tagged = { ...idea, experiment_id: 'exp-1' }
    render(<IdeaDetailModal idea={tagged} onClose={() => {}} onSave={async () => {}} activeExperiment={active} />)
    const checkbox = screen.getByLabelText(/Part of experiment: Shorter hooks win/) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('saves experiment_id when the checkbox is checked', async () => {
    const active = { id: 'exp-1', hypothesis: 'Shorter hooks win', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} activeExperiment={active} />)

    fireEvent.click(screen.getByLabelText(/Part of experiment: Shorter hooks win/))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({ experiment_id: 'exp-1' }))
  })

  it('saves experiment_id as null when the checkbox is unchecked', async () => {
    const active = { id: 'exp-1', hypothesis: 'Shorter hooks win', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const tagged = { ...idea, experiment_id: 'exp-1' }
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={tagged} onClose={() => {}} onSave={onSave} activeExperiment={active} />)

    fireEvent.click(screen.getByLabelText(/Part of experiment: Shorter hooks win/))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({ experiment_id: null }))
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/IdeaDetailModal.test.tsx`
Expected: FAIL — `activeExperiment` prop doesn't exist on the component's props type (TS error) / checkbox not found.

- [ ] **Step 3: Add the `activeExperiment` prop and checkbox to `IdeaDetailModal`**

In `src/components/IdeaDetailModal.tsx`, update the imports and `Props` type:

```typescript
import type { ContentIdea, Pillar, Platform, ContentClass, Experiment } from '@/types/content'
```

```typescript
type Props = {
  idea: ContentIdea
  onClose: () => void
  onSave: (id: string, changes: Partial<ContentIdea>) => Promise<void>
  activeExperiment: Experiment | null
}
```

Update the function signature:

```typescript
export default function IdeaDetailModal({ idea, onClose, onSave, activeExperiment }: Props) {
```

Add state, near the other `useState` calls:

```typescript
  const [experimentTagged, setExperimentTagged] = useState(idea.experiment_id === activeExperiment?.id && activeExperiment !== null)
```

Add `experiment_id` to the `onSave` call in `handleSave`, alongside the other fields:

```typescript
        execution_score_notes: executionScoreNotes || null,
        experiment_id: experimentTagged && activeExperiment ? activeExperiment.id : null,
```

Add the checkbox markup, right before the final `<button onClick={() => void handleSave()}`:

```tsx
        {activeExperiment && (
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={experimentTagged}
              onChange={e => setExperimentTagged(e.target.checked)}
            />
            Part of experiment: {activeExperiment.hypothesis}
          </label>
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/IdeaDetailModal.test.tsx`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 5: Wire `activeExperiment` into `Ideas.tsx` and `Pipeline.tsx`**

In `src/pages/Ideas.tsx`, add the import and hook call:

```typescript
import { useExperiments } from '@/hooks/useExperiments'
```

```typescript
  const { active: activeExperiment } = useExperiments()
```

Pass it to the modal:

```tsx
      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onSave={update}
          activeExperiment={activeExperiment}
        />
      )}
```

In `src/pages/Pipeline.tsx`, add the same import and hook call, and pass `activeExperiment={activeExperiment}` to its `<IdeaDetailModal>` the same way.

- [ ] **Step 6: Run the full build and test suite**

Run: `cd C:\Users\gregm\content && npm run build && npm test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/IdeaDetailModal.tsx src/pages/Ideas.tsx src/pages/Pipeline.tsx src/__tests__/IdeaDetailModal.test.tsx
git commit -m "feat: tag ideas into the active experiment from IdeaDetailModal"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Run the app end to end**

Run: `cd C:\Users\gregm\content && npm run dev`, open the app.

- Go to `/analytics`, start an experiment with a hypothesis.
- Open an idea from `/ideas` or `/pipeline`, confirm the "Part of experiment: ..." checkbox appears, check it, save.
- Return to `/analytics`, confirm that idea now appears in the experiment's table.
- Write a verdict, click "Conclude Experiment", confirm it moves to the collapsed concluded list and the form to start a new experiment reappears.
- Confirm the checkbox no longer appears when opening ideas (no active experiment).

- [ ] **Step 2: Push**

```bash
git push
```
