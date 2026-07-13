# Idea Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modal to Content Manager that lets Carl view and edit an idea's `title`, `hook`, `body`, `notes`, `pillar`, and `platform` — fields that already exist in the data model but have no UI.

**Architecture:** A new `IdeaDetailModal.tsx` component receives the selected `ContentIdea` and an `onClose`/`onSave` pair. `Pipeline.tsx` and `Ideas.tsx` each hold a `selectedIdea` state and pass an `onOpen` handler down to `IdeaCard`, which now makes its body clickable (separate from the existing delete `✕` and "Move →" click targets, which must keep working unchanged).

**Tech Stack:** React 18, TypeScript (`strict: true`), Vitest + Testing Library (existing patterns in `src/__tests__/`).

---

## Task 1: `IdeaDetailModal` component

**Files:**
- Create: `C:\Users\gregm\content\src\components\IdeaDetailModal.tsx`
- Test: `C:\Users\gregm\content\src\__tests__\IdeaDetailModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/IdeaDetailModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdeaDetailModal from '@/components/IdeaDetailModal'
import type { ContentIdea } from '@/types/content'

const idea: ContentIdea = {
  id: 'idea-1',
  title: 'Original title',
  body: 'Original body',
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: 'Original hook',
  notes: 'Original notes',
  scheduled_at: null,
  posted_at: null,
  views: null,
  likes: null,
  shares: null,
  saves: null,
  post_url: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('IdeaDetailModal', () => {
  it('renders the idea\'s current field values', () => {
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.getByDisplayValue('Original title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Original hook')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Original body')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Original notes')).toBeInTheDocument()
  })

  it('calls onSave with edited fields when Save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('Original body'), {
      target: { value: 'Revised body' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({
      title: 'Original title',
      hook: 'Original hook',
      body: 'Revised body',
      notes: 'Original notes',
      pillar: 'training',
      platform: 'tiktok',
    }))
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<IdeaDetailModal idea={idea} onClose={onClose} onSave={async () => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/IdeaDetailModal.test.tsx`
Expected: FAIL — `Cannot find module '@/components/IdeaDetailModal'`

- [ ] **Step 3: Write the implementation**

Create `src/components/IdeaDetailModal.tsx`:

```tsx
import { useState } from 'react'
import type { ContentIdea, Pillar, Platform } from '@/types/content'
import { PILLARS, PLATFORMS } from '@/lib/constants'

type Props = {
  idea: ContentIdea
  onClose: () => void
  onSave: (id: string, changes: Partial<ContentIdea>) => Promise<void>
}

export default function IdeaDetailModal({ idea, onClose, onSave }: Props) {
  const [title, setTitle] = useState(idea.title)
  const [hook, setHook] = useState(idea.hook ?? '')
  const [body, setBody] = useState(idea.body ?? '')
  const [notes, setNotes] = useState(idea.notes ?? '')
  const [pillar, setPillar] = useState<Pillar>(idea.pillar)
  const [platform, setPlatform] = useState<Platform>(idea.platform)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(idea.id, {
        title,
        hook: hook || null,
        body: body || null,
        notes: notes || null,
        pillar,
        platform,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Edit Idea</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full"
          placeholder="Hook"
          value={hook}
          onChange={e => setHook(e.target.value)}
        />

        <textarea
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full min-h-[160px]"
          placeholder="Body / script / caption"
          value={body}
          onChange={e => setBody(e.target.value)}
        />

        <textarea
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full min-h-[80px]"
          placeholder="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className="flex gap-3">
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white flex-1"
            value={pillar}
            onChange={e => setPillar(e.target.value as Pillar)}
          >
            {PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white flex-1"
            value={platform}
            onChange={e => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-accent text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/IdeaDetailModal.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\content
git add src/components/IdeaDetailModal.tsx src/__tests__/IdeaDetailModal.test.tsx
git commit -m "feat: add IdeaDetailModal for viewing/editing idea body, hook, notes"
```

---

## Task 2: Wire `IdeaCard` to open the modal

**Files:**
- Modify: `C:\Users\gregm\content\src\components\IdeaCard.tsx`
- Test: `C:\Users\gregm\content\src\__tests__\IdeaCard.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/IdeaCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdeaCard from '@/components/IdeaCard'
import type { ContentIdea } from '@/types/content'

const idea: ContentIdea = {
  id: 'idea-1',
  title: 'Card title',
  body: null,
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: null,
  notes: null,
  scheduled_at: null,
  posted_at: null,
  views: null,
  likes: null,
  shares: null,
  saves: null,
  post_url: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('IdeaCard', () => {
  it('calls onOpen when the card body is clicked', () => {
    const onOpen = vi.fn()
    render(
      <IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={onOpen} />
    )
    fireEvent.click(screen.getByText('Card title'))
    expect(onOpen).toHaveBeenCalledWith(idea)
  })

  it('does not call onOpen when delete is clicked', () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(
      <IdeaCard idea={idea} onMove={() => {}} onDelete={onDelete} onOpen={onOpen} />
    )
    fireEvent.click(screen.getByText('✕'))
    expect(onDelete).toHaveBeenCalledWith('idea-1')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/IdeaCard.test.tsx`
Expected: FAIL — `onOpen` prop doesn't exist / TS error, or `onOpen` never called

- [ ] **Step 3: Modify `IdeaCard.tsx`**

Full new contents of `src/components/IdeaCard.tsx`:

```tsx
import type { ContentIdea, PipelineStatus } from '@/types/content'
import PillarBadge from './PillarBadge'
import StatusBadge from './StatusBadge'
import { PIPELINE_STAGES, SUGGESTED_DAYS } from '@/lib/constants'

type Props = {
  idea: ContentIdea
  onMove: (id: string, status: PipelineStatus) => void
  onDelete: (id: string) => void
  onOpen: (idea: ContentIdea) => void
}

export default function IdeaCard({ idea, onMove, onDelete, onOpen }: Props) {
  const currentIdx = PIPELINE_STAGES.indexOf(idea.status)
  const nextStage = PIPELINE_STAGES[currentIdx + 1] ?? null

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => onOpen(idea)}
      >
        <p className="text-sm font-medium text-white leading-snug">{idea.title}</p>
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
      </div>
      {nextStage && (
        <button
          onClick={e => { e.stopPropagation(); onMove(idea.id, nextStage) }}
          className="mt-1 text-xs text-accent hover:underline text-left"
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

Note: `onDelete`/`onMove` click handlers now call `e.stopPropagation()` so clicking them doesn't also fire `onOpen` (they sit inside the same card, delete is inside the clickable header row).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/IdeaCard.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\content
git add src/components/IdeaCard.tsx src/__tests__/IdeaCard.test.tsx
git commit -m "feat: make IdeaCard clickable to open detail modal"
```

---

## Task 3: Wire the modal into `Pipeline.tsx` and `Ideas.tsx`

**Files:**
- Modify: `C:\Users\gregm\content\src\pages\Pipeline.tsx`
- Modify: `C:\Users\gregm\content\src\pages\Ideas.tsx`

No new automated test here — `IdeaDetailModal` and `IdeaCard` are already covered; this task is wiring existing tested pieces together. Verification is manual (Task 4).

- [ ] **Step 1: Modify `Pipeline.tsx`**

Full new contents of `src/pages/Pipeline.tsx`:

```tsx
import { useState } from 'react'
import { usePipeline } from '@/hooks/usePipeline'
import { PIPELINE_STAGES } from '@/lib/constants'
import IdeaCard from '@/components/IdeaCard'
import IdeaDetailModal from '@/components/IdeaDetailModal'
import { useIdeas } from '@/hooks/useIdeas'
import type { ContentIdea } from '@/types/content'

export default function Pipeline() {
  const { grouped, loading, moveStage, remove } = usePipeline()
  const { update } = useIdeas()
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null)

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">Pipeline</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => {
          const cards = grouped.get(stage) ?? []
          return (
            <div key={stage} className="flex-shrink-0 w-64 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stage}</p>
                <span className="text-xs text-gray-600">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map(idea => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onMove={moveStage}
                    onDelete={remove}
                    onOpen={setSelectedIdea}
                  />
                ))}
                {cards.length === 0 && (
                  <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-gray-700">
                    Empty
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onSave={update}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Modify `Ideas.tsx`**

In `src/pages/Ideas.tsx`, apply these changes:

Add to the imports at the top (after the existing imports):

```tsx
import IdeaDetailModal from '@/components/IdeaDetailModal'
```

Change the existing type import line from:

```tsx
import type { Pillar, Platform, NewContentIdea } from '@/types/content'
```

to:

```tsx
import type { Pillar, Platform, NewContentIdea, ContentIdea } from '@/types/content'
```

Add new state alongside the existing `useState` calls (after the `filterPillar` state declaration):

```tsx
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null)
```

Update the `IdeaCard` usage to pass `onOpen`:

```tsx
            <IdeaCard
              key={idea.id}
              idea={idea}
              onMove={(id, status) => void update(id, { status })}
              onDelete={(id) => void remove(id)}
              onOpen={setSelectedIdea}
            />
```

Add the modal render just before the closing `</div>` of the outer container (after the `{/* List */}` block):

```tsx
      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onSave={update}
        />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `cd C:\Users\gregm\content && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `cd C:\Users\gregm\content && npx vitest run`
Expected: all tests pass (existing suite + the 5 new tests from Tasks 1-2)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\gregm\content
git add src/pages/Pipeline.tsx src/pages/Ideas.tsx
git commit -m "feat: wire IdeaDetailModal into Pipeline and Ideas pages"
```

---

## Task 4: Manual verification in the browser

- [ ] **Step 1: Start the dev server**

Run: `cd C:\Users\gregm\content && npm run dev`

- [ ] **Step 2: Verify Pipeline page**

Open the app, go to the Pipeline tab, click an idea card's title/body (not the ✕ or "Move →" links) — modal should open with that idea's current fields. Edit the Body field, click Save, confirm the modal closes and the change persisted (reopen the card to confirm).

- [ ] **Step 3: Verify Ideas page**

Same check on the Ideas tab: click a card, edit fields, save, reopen to confirm persistence.

- [ ] **Step 4: Verify delete/move still work standalone**

On both pages, click the ✕ and "Move →" controls directly — confirm they still delete/move without opening the modal.

- [ ] **Step 5: Push**

```bash
cd C:\Users\gregm\content
git push
```
