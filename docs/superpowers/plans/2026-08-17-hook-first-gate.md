# Hook-First Production Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the IDEA→DRAFT move in Content Manager on 4 required hook-first fields (plus 2 conditional justifications), per the approved design spec.

**Architecture:** 6 new nullable columns on `content_ideas`, a pure `isReadyForDraft()` gate function, a disabled-button UI treatment on `IdeaCard`, and a new form section on `IdeaDetailModal`. No changes past the DRAFT transition.

**Tech Stack:** React + TypeScript, Vite, Vitest + Testing Library, Supabase.

---

### Task 1: Add the 6 columns to `content_ideas`

**Files:** none (migration applied directly via Supabase MCP — this repo has no local `supabase/migrations/` convention, unlike Row)

- [ ] **Step 1: Apply the migration**

Use the `apply_migration` tool, `project_id: vikpcejlyxieguorwysf`, `name: add_hook_first_gate_columns`:

```sql
alter table content_ideas
  add column content_class text,
  add column hook_first_2s text,
  add column viewer_payoff text,
  add column target_length_seconds integer,
  add column length_justification text,
  add column diary_justification text;
```

- [ ] **Step 2: Verify**

Use `execute_sql` against `vikpcejlyxieguorwysf`:

```sql
select column_name from information_schema.columns
where table_name = 'content_ideas'
  and column_name in ('content_class', 'hook_first_2s', 'viewer_payoff', 'target_length_seconds', 'length_justification', 'diary_justification')
order by column_name;
```

Expected: all 6 column names returned.

---

### Task 2: Update the `ContentIdea` type and every fixture that builds a full one

**Files:**
- Modify: `C:\Users\gregm\content\src\types\content.ts`
- Modify: `C:\Users\gregm\content\src\pages\Ideas.tsx:8-30` (the `empty: NewContentIdea` object)
- Modify: `C:\Users\gregm\content\src\__tests__\IdeaCard.test.tsx:6-36` (the `idea` fixture)
- Modify: `C:\Users\gregm\content\src\__tests__\IdeaDetailModal.test.tsx:6-36` (the `idea` fixture)

- [ ] **Step 1: Add the type**

In `src/types/content.ts`, add after the existing `Platform` type:

```typescript
export type ContentClass = 'technique' | 'craft' | 'transformation' | 'diary'
```

Then add these 6 fields to the `ContentIdea` type, right after `hook: string | null`:

```typescript
  content_class: ContentClass | null
  hook_first_2s: string | null
  viewer_payoff: string | null
  target_length_seconds: number | null
  length_justification: string | null
  diary_justification: string | null
```

- [ ] **Step 2: Update `Ideas.tsx`'s `empty` object**

In `src/pages/Ideas.tsx`, in the `empty: NewContentIdea` object, add right after `hook: null,`:

```typescript
  content_class: null,
  hook_first_2s: null,
  viewer_payoff: null,
  target_length_seconds: null,
  length_justification: null,
  diary_justification: null,
```

- [ ] **Step 3: Update `IdeaCard.test.tsx`'s `idea` fixture**

In `src/__tests__/IdeaCard.test.tsx`, in the `idea: ContentIdea` object, add right after `hook: null,`:

```typescript
  content_class: null,
  hook_first_2s: null,
  viewer_payoff: null,
  target_length_seconds: null,
  length_justification: null,
  diary_justification: null,
```

- [ ] **Step 4: Update `IdeaDetailModal.test.tsx`'s `idea` fixture**

In `src/__tests__/IdeaDetailModal.test.tsx`, in the `idea: ContentIdea` object, add right after `hook: 'Original hook',`:

```typescript
  content_class: null,
  hook_first_2s: null,
  viewer_payoff: null,
  target_length_seconds: null,
  length_justification: null,
  diary_justification: null,
```

- [ ] **Step 5: Verify the project still typechecks and tests still pass**

```bash
cd "C:\Users\gregm\content"
npx tsc --noEmit
npm test
```

Expected: both succeed with the same pass count as before this task (no new tests yet — this task only touches types/fixtures).

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\gregm\content"
git add src/types/content.ts src/pages/Ideas.tsx src/__tests__/IdeaCard.test.tsx src/__tests__/IdeaDetailModal.test.tsx
git commit -m "feat: add hook-first gate fields to ContentIdea type"
```

---

### Task 3: `isReadyForDraft()` gate function (TDD)

**Files:**
- Create: `C:\Users\gregm\content\src\lib\hookGate.ts`
- Test: `C:\Users\gregm\content\src\__tests__\hookGate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { isReadyForDraft } from '@/lib/hookGate'
import type { ContentIdea } from '@/types/content'

const BASE: ContentIdea = {
  id: 'idea-1',
  title: 'Card title',
  body: null,
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: null,
  content_class: 'technique',
  hook_first_2s: 'Open on the failed rep',
  viewer_payoff: 'The exact cue that fixes it',
  target_length_seconds: 22,
  length_justification: null,
  diary_justification: null,
  notes: null,
  scheduled_at: null,
  posted_at: null,
  views: null,
  likes: null,
  shares: null,
  saves: null,
  post_url: null,
  post_url_instagram: null,
  idea_score: null,
  idea_score_notes: null,
  execution_score: null,
  execution_score_notes: null,
  predicted_score: null,
  predicted_reasoning: null,
  predicted_at: null,
  prediction_version: null,
  metricool_reach: null,
  metricool_engagement_rate: null,
  metricool_comments: null,
  metricool_synced_at: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('isReadyForDraft', () => {
  it('is ready when all 4 base fields are present, length <=30, non-diary', () => {
    expect(isReadyForDraft(BASE)).toEqual({ ready: true, missing: [] })
  })

  it('is not ready when content_class is missing', () => {
    const idea = { ...BASE, content_class: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('content class')
  })

  it('is not ready when hook_first_2s is missing', () => {
    const idea = { ...BASE, hook_first_2s: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('opening hook')
  })

  it('is not ready when viewer_payoff is missing', () => {
    const idea = { ...BASE, viewer_payoff: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('viewer payoff')
  })

  it('is not ready when target_length_seconds is missing', () => {
    const idea = { ...BASE, target_length_seconds: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('target length')
  })

  it('is not ready for diary class without diary_justification', () => {
    const idea = { ...BASE, content_class: 'diary' as const, diary_justification: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('diary justification')
  })

  it('is ready for diary class with diary_justification', () => {
    const idea = { ...BASE, content_class: 'diary' as const, diary_justification: 'Real transformation story, earns the exception' }
    expect(isReadyForDraft(idea)).toEqual({ ready: true, missing: [] })
  })

  it('is ready at exactly 30 seconds with no justification', () => {
    const idea = { ...BASE, target_length_seconds: 30 }
    expect(isReadyForDraft(idea)).toEqual({ ready: true, missing: [] })
  })

  it('is not ready over 30 seconds without length_justification', () => {
    const idea = { ...BASE, target_length_seconds: 45, length_justification: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('length justification (over 30s)')
  })

  it('is ready over 30 seconds with length_justification', () => {
    const idea = { ...BASE, target_length_seconds: 45, length_justification: 'Pushup narrative earns the extra runtime' }
    expect(isReadyForDraft(idea)).toEqual({ ready: true, missing: [] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:\Users\gregm\content"
npx vitest run src/__tests__/hookGate.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/hookGate"`.

- [ ] **Step 3: Write the implementation**

```typescript
import type { ContentIdea } from '@/types/content'

export function isReadyForDraft(idea: ContentIdea): { ready: boolean; missing: string[] } {
  const missing: string[] = []
  if (!idea.content_class) missing.push('content class')
  if (!idea.hook_first_2s) missing.push('opening hook')
  if (!idea.viewer_payoff) missing.push('viewer payoff')
  if (!idea.target_length_seconds) missing.push('target length')
  if (idea.target_length_seconds != null && idea.target_length_seconds > 30 && !idea.length_justification) {
    missing.push('length justification (over 30s)')
  }
  if (idea.content_class === 'diary' && !idea.diary_justification) {
    missing.push('diary justification')
  }
  return { ready: missing.length === 0, missing }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd "C:\Users\gregm\content"
npx vitest run src/__tests__/hookGate.test.ts
```

Expected: PASS, 10/10 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\gregm\content"
git add src/lib/hookGate.ts src/__tests__/hookGate.test.ts
git commit -m "feat: add isReadyForDraft() hook-first gate function"
```

---

### Task 4: Gate `IdeaCard`'s Move → DRAFT button (TDD)

**Files:**
- Modify: `C:\Users\gregm\content\src\components\IdeaCard.tsx`
- Modify: `C:\Users\gregm\content\src\__tests__\IdeaCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/IdeaCard.test.tsx`, inside the existing `describe('IdeaCard', ...)` block:

```typescript
  it('disables Move -> DRAFT when the hook-first gate is not satisfied', () => {
    render(<IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → DRAFT') as HTMLButtonElement
    expect(moveButton.disabled).toBe(true)
  })

  it('enables Move -> DRAFT when the hook-first gate is satisfied', () => {
    const ready = {
      ...idea,
      content_class: 'technique' as const,
      hook_first_2s: 'Open on the failed rep',
      viewer_payoff: 'The exact cue that fixes it',
      target_length_seconds: 22,
    }
    render(<IdeaCard idea={ready} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → DRAFT') as HTMLButtonElement
    expect(moveButton.disabled).toBe(false)
  })

  it('does not gate moves to stages other than DRAFT', () => {
    const draftIdea = { ...idea, status: 'DRAFT' as const }
    render(<IdeaCard idea={draftIdea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → READY') as HTMLButtonElement
    expect(moveButton.disabled).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:\Users\gregm\content"
npx vitest run src/__tests__/IdeaCard.test.tsx
```

Expected: the 2 new DRAFT-gate tests FAIL (button isn't disabled yet — `disabled` is `false`/`undefined` in all cases); the "other stages" test passes already since nothing gates it yet.

- [ ] **Step 3: Implement the gate in `IdeaCard.tsx`**

Modify `src/components/IdeaCard.tsx`:

```typescript
import type { ContentIdea, PipelineStatus } from '@/types/content'
import PillarBadge from './PillarBadge'
import StatusBadge from './StatusBadge'
import { PIPELINE_STAGES, SUGGESTED_DAYS } from '@/lib/constants'
import { isReadyForDraft } from '@/lib/hookGate'

type Props = {
  idea: ContentIdea
  onMove: (id: string, status: PipelineStatus) => void
  onDelete: (id: string) => void
  onOpen: (idea: ContentIdea) => void
}

export default function IdeaCard({ idea, onMove, onDelete, onOpen }: Props) {
  const currentIdx = PIPELINE_STAGES.indexOf(idea.status)
  const nextStage = PIPELINE_STAGES[currentIdx + 1] ?? null
  const gate = nextStage === 'DRAFT' ? isReadyForDraft(idea) : { ready: true, missing: [] }

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => onOpen(idea)}
      >
        <p className="text-sm font-medium text-gray-900 leading-snug">{idea.title}</p>
        <button
          onClick={e => { e.stopPropagation(); onDelete(idea.id) }}
          className="text-gray-600 hover:text-red-400 text-xs shrink-0"
        >
          ✕
        </button>
      </div>
      {idea.hook && (
        <p className="text-xs text-gray-500 italic">"{idea.hook}"</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <PillarBadge pillar={idea.pillar} />
        <StatusBadge status={idea.status} />
        <span className="text-xs text-gray-600">{idea.platform}</span>
        {idea.idea_score != null && (
          <span className="text-xs text-gray-600">🎯 {idea.idea_score}</span>
        )}
        {idea.execution_score != null && (
          <span className="text-xs text-gray-600">🎬 {idea.execution_score}</span>
        )}
        {idea.predicted_score != null && (
          <span className="text-xs text-gray-600" title={idea.predicted_reasoning ?? undefined}>🔮 {idea.predicted_score}</span>
        )}
      </div>
      {nextStage && (
        <button
          onClick={e => { e.stopPropagation(); onMove(idea.id, nextStage) }}
          disabled={!gate.ready}
          title={gate.ready ? undefined : `Missing: ${gate.missing.join(', ')}`}
          className="mt-1 text-xs text-accent hover:underline text-left disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
        >
          Move → {nextStage}
        </button>
      )}
      {nextStage === 'SCHEDULED' && (
        <p className="text-xs text-gray-600">Suggested: {SUGGESTED_DAYS[idea.platform]}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:\Users\gregm\content"
npx vitest run src/__tests__/IdeaCard.test.tsx
```

Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\gregm\content"
git add src/components/IdeaCard.tsx src/__tests__/IdeaCard.test.tsx
git commit -m "feat: gate Move -> DRAFT on the hook-first gate"
```

---

### Task 5: Hook-First Brief section in `IdeaDetailModal`

**Files:**
- Modify: `C:\Users\gregm\content\src\components\IdeaDetailModal.tsx`

- [ ] **Step 1: Add state and the save payload**

In `src/components/IdeaDetailModal.tsx`, add these state hooks right after the existing `hook` state (`const [hook, setHook] = useState(idea.hook ?? '')`):

```typescript
  const [contentClass, setContentClass] = useState<ContentClass | ''>(idea.content_class ?? '')
  const [hookFirst2s, setHookFirst2s] = useState(idea.hook_first_2s ?? '')
  const [viewerPayoff, setViewerPayoff] = useState(idea.viewer_payoff ?? '')
  const [targetLength, setTargetLength] = useState(idea.target_length_seconds?.toString() ?? '')
  const [lengthJustification, setLengthJustification] = useState(idea.length_justification ?? '')
  const [diaryJustification, setDiaryJustification] = useState(idea.diary_justification ?? '')
```

Update the import line to include `ContentClass`:

```typescript
import type { ContentIdea, Pillar, Platform, ContentClass } from '@/types/content'
```

- [ ] **Step 2: Include the new fields in `handleSave`**

In `handleSave`, add to the `onSave(idea.id, { ... })` object, right after `hook: hook || null,`:

```typescript
        content_class: contentClass || null,
        hook_first_2s: hookFirst2s || null,
        viewer_payoff: viewerPayoff || null,
        target_length_seconds: targetLength.trim() === '' ? null : Math.round(Number(targetLength)),
        length_justification: lengthJustification || null,
        diary_justification: diaryJustification || null,
```

- [ ] **Step 3: Add the Hook-First Brief section to the JSX**

Insert this block right after the `<textarea placeholder="Notes" ... />` element and before the pillar/platform `<div className="flex gap-3">`:

```typescript
        {idea.status === 'IDEA' && (
          <div className="border border-border rounded-lg p-3 flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-700">Hook-First Brief</p>

            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-900"
              value={contentClass}
              onChange={e => setContentClass(e.target.value as ContentClass)}
            >
              <option value="">Content class...</option>
              <option value="technique">Technique</option>
              <option value="craft">Craft</option>
              <option value="transformation">Transformation</option>
              <option value="diary">Diary</option>
            </select>

            <input
              className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
              placeholder="Opening hook (first 1-2 seconds)"
              value={hookFirst2s}
              onChange={e => setHookFirst2s(e.target.value)}
            />

            <input
              className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
              placeholder="Viewer payoff (what they get for watching)"
              value={viewerPayoff}
              onChange={e => setViewerPayoff(e.target.value)}
            />

            <input
              type="number"
              min={1}
              className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-32"
              placeholder="Target length (s)"
              value={targetLength}
              onChange={e => setTargetLength(e.target.value)}
            />

            {Number(targetLength) > 30 && (
              <input
                className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
                placeholder="Why does this earn extra length?"
                value={lengthJustification}
                onChange={e => setLengthJustification(e.target.value)}
              />
            )}

            {contentClass === 'diary' && (
              <input
                className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
                placeholder="Why does this earn diary treatment anyway?"
                value={diaryJustification}
                onChange={e => setDiaryJustification(e.target.value)}
              />
            )}
          </div>
        )}
```

- [ ] **Step 4: Run the full test suite**

```bash
cd "C:\Users\gregm\content"
npx tsc --noEmit
npm test
```

Expected: `tsc` reports no errors; `npm test` shows the same pass count as after Task 4 plus no new failures (`IdeaDetailModal.test.tsx`'s existing tests still pass unchanged since they don't touch the new section).

- [ ] **Step 5: Manual verification in the dev server**

```bash
cd "C:\Users\gregm\content"
npm run dev
```

Open the app, open any IDEA-status card's detail modal, confirm the "Hook-First Brief" section renders with the content-class dropdown, hook/payoff/length inputs, and that the two justification inputs only appear when triggered (select "Diary" → diary justification appears; type a length over 30 → length justification appears). Confirm the card's "Move → DRAFT" button is disabled until all required fields are filled, then enables once they are. Stop the dev server after confirming (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\gregm\content"
git add src/components/IdeaDetailModal.tsx
git commit -m "feat: add Hook-First Brief section to IdeaDetailModal"
```

---

## Out of Scope (reiterated from the design spec)

- No changes to any pipeline stage past DRAFT
- No retroactive backfill of the 6 new fields on existing rows
- No DB-level CHECK constraint enforcing the gate — UI-only, matches this app's single-user trust model
