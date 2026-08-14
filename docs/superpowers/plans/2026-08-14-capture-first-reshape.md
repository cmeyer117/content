# Capture-First Reshape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `content-autopilot`'s existing (but never-fed) video pipeline a second, frictionless intake door — a mobile upload page in Content Manager, backed by a private Supabase bucket, that `content-autopilot`'s existing scheduled sweep picks up automatically. No transcription/caption/hook code — all of that already exists in `content-autopilot` and stays untouched.

**Architecture:** A new private Storage bucket (`raw-captures`) is the queue itself — no new DB table. Content Manager's new `/capture` page (replacing `/dashboard` as the landing route) uploads straight to that bucket under the owner's existing authenticated session. A new script in `jarvis-embed` lists/downloads/deletes objects from that bucket using the service-role key already present in `jarvis-embed/.env`. `content-autopilot`'s Step 1 gets one added check that calls that script, feeding results into its unchanged Step 2 pipeline.

**Tech Stack:** React + TypeScript + Vite (Content Manager, existing), Vitest + React Testing Library (existing test setup), `@supabase/supabase-js` (existing dependency in both Content Manager and `jarvis-embed`), Supabase Storage + Postgres RLS.

**Repos touched:** `C:\Users\gregm\content` (GitHub `cmeyer117/content`, `master`), `C:\Users\gregm\jarvis-embed` (new script, not tracked in a repo — confirm during Task 5 whether it's gitignored/untracked like the rest of that directory's working scripts), and the `content-autopilot` scheduled task (edited via MCP tool, not a file on this machine).

**Spec:** `docs/superpowers/specs/2026-08-14-capture-first-reshape-design.md`

---

### Task 1: Create the `raw-captures` Storage bucket and RLS policy

This is a live Supabase change applied directly via the Supabase MCP tools (this project has no tracked `supabase/migrations/` folder — confirmed by its absence; schema/storage changes here are applied live and verified live, same pattern used earlier today for this same project's `content_ideas` policies).

**Files:** none (live infra change only)

- [ ] **Step 1: Apply the bucket + policy**

Call `mcp__715f7ddf-65b1-4907-98e7-94e9e6309a73__apply_migration` (or the equivalent Supabase MCP migration tool available in your session) with `project_id: "vikpcejlyxieguorwysf"`, `name: "raw_captures_bucket"`, and this query:

```sql
insert into storage.buckets (id, name, public)
values ('raw-captures', 'raw-captures', false)
on conflict (id) do nothing;

create policy "owner read raw-captures"
  on storage.objects for select to authenticated
  using (bucket_id = 'raw-captures' and public.coaching_is_owner());

create policy "owner write raw-captures"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'raw-captures' and public.coaching_is_owner());

create policy "owner delete raw-captures"
  on storage.objects for delete to authenticated
  using (bucket_id = 'raw-captures' and public.coaching_is_owner());
```

(A delete policy is included for completeness/future owner-side cleanup UI, even though Task 5's script uses the service-role key, which bypasses RLS entirely and doesn't need it.)

- [ ] **Step 2: Verify live**

Run this via the Supabase MCP `execute_sql` tool against the same project:

```sql
select b.id, b.public, p.policyname, p.cmd
from storage.buckets b
left join pg_policies p on p.tablename = 'objects' and p.qual::text ilike '%raw-captures%'
where b.id = 'raw-captures';
```

Expected: one row with `public = false`, and 3 policy rows (`select`/`insert`/`delete`, matching the policy names above — `pg_policies` may show insert's `with check` under a different column than `qual`; if the insert row doesn't show via this exact query, run `select policyname, cmd from pg_policies where tablename='objects' and policyname ilike '%raw-captures%';` instead to confirm all 3 exist).

---

### Task 2: Pure logic — capture object naming and list formatting

**Files:**
- Create: `src/lib/captureLogic.ts`
- Test: `src/__tests__/captureLogic.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/captureLogic.test.ts
import { describe, it, expect } from 'vitest'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'

describe('captureObjectName', () => {
  it('prefixes the filename with the given timestamp', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    const name = captureObjectName(file, new Date('2026-08-14T12:00:00.000Z'))
    expect(name).toBe('1755172800000-clip.mp4')
  })

  it('sanitizes unsafe characters in the original filename', () => {
    const file = new File(['x'], 'leg day (final)!!.mov', { type: 'video/quicktime' })
    const name = captureObjectName(file, new Date('2026-08-14T12:00:00.000Z'))
    expect(name).toBe('1755172800000-leg_day__final___.mov')
  })
})

describe('formatCaptureAge', () => {
  it('formats a recent upload in minutes', () => {
    const uploadedAt = new Date('2026-08-14T12:00:00.000Z')
    const now = new Date('2026-08-14T12:05:00.000Z')
    expect(formatCaptureAge(uploadedAt, now)).toBe('5m ago')
  })

  it('formats an older upload in hours', () => {
    const uploadedAt = new Date('2026-08-14T12:00:00.000Z')
    const now = new Date('2026-08-14T15:30:00.000Z')
    expect(formatCaptureAge(uploadedAt, now)).toBe('3h ago')
  })

  it('formats an upload under a minute old as just now', () => {
    const uploadedAt = new Date('2026-08-14T12:00:00.000Z')
    const now = new Date('2026-08-14T12:00:30.000Z')
    expect(formatCaptureAge(uploadedAt, now)).toBe('just now')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/captureLogic.test.ts`
Expected: FAIL — `Cannot find module '@/lib/captureLogic'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/captureLogic.ts

// Object names in the raw-captures bucket are timestamp-prefixed so uploads
// sort chronologically by name alone, and so a re-upload of the same
// filename never collides with an existing object.
export function captureObjectName(file: File, now: Date = new Date()): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${now.getTime()}-${safeName}`
}

export function formatCaptureAge(uploadedAt: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - uploadedAt.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/captureLogic.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git -C C:\Users\gregm\content add src/lib/captureLogic.ts src/__tests__/captureLogic.test.ts
git -C C:\Users\gregm\content commit -m "feat: pure logic for capture object naming and list formatting"
```

---

### Task 3: The `/capture` page

**Files:**
- Create: `src/pages/Capture.tsx`
- Test: `src/__tests__/Capture.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/Capture.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Capture from '@/pages/Capture'

const listMock = vi.fn()
const uploadMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        list: (...args: unknown[]) => listMock(...args),
        upload: (...args: unknown[]) => uploadMock(...args),
      }),
    },
  },
}))

beforeEach(() => {
  listMock.mockReset()
  uploadMock.mockReset()
})

describe('Capture', () => {
  it('shows an empty state when nothing is waiting', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    expect(screen.getByText(/nothing waiting/i)).toBeTruthy()
  })

  it('lists a pending capture with its age', async () => {
    listMock.mockResolvedValue({
      data: [{ name: '1755172800000-clip.mp4', created_at: '2026-08-14T12:00:00.000Z' }],
      error: null,
    })
    render(<Capture />)
    expect(await screen.findByText(/clip\.mp4/)).toBeTruthy()
  })

  it('uploads a selected file and shows it in the waiting list', async () => {
    listMock.mockResolvedValueOnce({ data: [], error: null })
    uploadMock.mockResolvedValue({ error: null })
    listMock.mockResolvedValueOnce({
      data: [{ name: '1755172800000-take.mp4', created_at: '2026-08-14T12:00:00.000Z' }],
      error: null,
    })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

    const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
    const input = screen.getByLabelText(/upload a take/i)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    expect(await screen.findByText(/take\.mp4/)).toBeTruthy()
  })

  it('shows a visible error and lets the user retry on upload failure', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    uploadMock.mockResolvedValue({ error: { message: 'Network error' } })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalled())

    const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
    const input = screen.getByLabelText(/upload a take/i)
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/upload failed/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/Capture.test.tsx`
Expected: FAIL — `Cannot find module '@/pages/Capture'`

- [ ] **Step 3: Write the implementation**

```tsx
// src/pages/Capture.tsx
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'

type PendingCapture = {
  name: string
  createdAt: Date
}

export default function Capture() {
  const [pending, setPending] = useState<PendingCapture[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFile, setLastFile] = useState<File | null>(null)

  const refresh = useCallback(async () => {
    const { data, error: listError } = await supabase.storage.from('raw-captures').list()
    if (listError || !data) return
    setPending(
      data
        .map(o => ({ name: o.name, createdAt: new Date(o.created_at) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const doUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setLastFile(file)
    const objectName = captureObjectName(file)
    const { error: uploadError } = await supabase.storage
      .from('raw-captures')
      .upload(objectName, file, { upsert: false, contentType: file.type })
    setUploading(false)
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      return
    }
    setLastFile(null)
    await refresh()
  }, [refresh])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void doUpload(file)
  }

  const handleRetry = () => {
    if (lastFile) void doUpload(lastFile)
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Capture</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a take. content-autopilot picks it up on its next sweep (11am / 6pm) —
          same transcription, captions, hooks, and Telegram review it already does.
        </p>
      </div>

      <label className="bg-accent text-white rounded-lg py-3 px-4 text-sm font-medium text-center cursor-pointer disabled:opacity-40">
        {uploading ? 'Uploading...' : 'Upload a take'}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          aria-label="Upload a take"
          disabled={uploading}
          onChange={handleChange}
        />
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={handleRetry}
            className="text-sm font-medium text-red-700 underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
          Waiting for next sweep
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing waiting.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map(p => (
              <li
                key={p.name}
                className="bg-card border border-border rounded-lg px-4 py-2 flex items-center justify-between text-sm"
              >
                <span className="text-gray-900 truncate">{p.name}</span>
                <span className="text-gray-400 shrink-0 ml-2">{formatCaptureAge(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\gregm\content && npx vitest run src/__tests__/Capture.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git -C C:\Users\gregm\content add src/pages/Capture.tsx src/__tests__/Capture.test.tsx
git -C C:\Users\gregm\content commit -m "feat: Capture page — upload straight into raw-captures bucket"
```

---

### Task 4: Wire routing — Capture replaces Dashboard as landing

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Update the route table**

In `src/App.tsx`, add the import and route, and change the root redirect:

```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import { IdeasProvider } from './hooks/useIdeas'
import Layout from './components/Layout'
import AuthGate from './components/AuthGate'
import Capture from './pages/Capture'
import Dashboard from './pages/Dashboard'
import Ideas from './pages/Ideas'
import Pipeline from './pages/Pipeline'
import Analytics from './pages/Analytics'
import Intel from './pages/Intel'

export default function App() {
  return (
    <AuthGate>
      <IdeasProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/intel" element={<Intel />} />
          </Routes>
        </Layout>
      </IdeasProvider>
    </AuthGate>
  )
}
```

- [ ] **Step 2: Update the nav order**

In `src/components/Layout.tsx`, put Capture first:

```typescript
const nav = [
  { to: '/capture', label: 'Capture' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ideas', label: 'Ideas' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/intel', label: 'Intel' },
]
```

- [ ] **Step 3: Run the full test suite**

Run: `cd C:\Users\gregm\content && npm test`
Expected: all existing tests still pass (no test in this repo currently asserts on the `/` redirect target or nav order — if one does, update its expectation to match the new landing route rather than reverting this change).

- [ ] **Step 4: Commit**

```bash
git -C C:\Users\gregm\content add src/App.tsx src/components/Layout.tsx
git -C C:\Users\gregm\content commit -m "feat: Capture replaces Dashboard as the landing route"
```

---

### Task 5: `download-raw-captures.mjs` in jarvis-embed

Mirrors `upload-content-media.mjs`'s existing style in the same directory (plain ESM script, `@supabase/supabase-js` already a dependency there, credentials from `.env` via `--env-file`).

**Files:**
- Create: `C:\Users\gregm\jarvis-embed\download-raw-captures.mjs`

- [ ] **Step 1: Check whether this directory's scripts are git-tracked**

Run: `git -C C:\Users\gregm\jarvis-embed status --short download-raw-captures.mjs 2>&1; git -C C:\Users\gregm\jarvis-embed remote -v`

If it's a real git repo with a remote, this new script gets committed there at the end of this task (same convention as its sibling files). If it's not a git repo (or has no remote), skip the commit step below — the file just needs to exist on disk, matching how `upload-content-media.mjs` itself is currently persisted.

- [ ] **Step 2: Write the script**

```javascript
// download-raw-captures.mjs
// Lists and downloads pending objects from Content Manager's raw-captures
// Supabase bucket (private, owner-RLS-gated) into the same local
// working-directory pattern content-autopilot already uses for
// Drive-sourced files. Uses the service-role key (bypasses RLS) since this
// runs unattended, not under the owner's browser session.
//
// Usage:
//   node --env-file=.env download-raw-captures.mjs list
//     -> prints one bucket object name per line, nothing else
//   node --env-file=.env download-raw-captures.mjs download <object-name> <local-dest-path>
//     -> downloads that object to the given local path
//   node --env-file=.env download-raw-captures.mjs delete <object-name>
//     -> deletes that object after it's been processed successfully

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const url = process.env['SUPABASE_URL']
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)
const BUCKET = 'raw-captures'

const [, , command, ...args] = process.argv

if (command === 'list') {
  const { data, error } = await supabase.storage.from(BUCKET).list()
  if (error) {
    console.error(`List failed: ${error.message}`)
    process.exit(1)
  }
  for (const obj of data ?? []) console.log(obj.name)
} else if (command === 'download') {
  const [objectName, localDest] = args
  if (!objectName || !localDest) {
    console.error('Usage: download-raw-captures.mjs download <object-name> <local-dest-path>')
    process.exit(1)
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(objectName)
  if (error || !data) {
    console.error(`Download failed: ${error?.message ?? 'no data returned'}`)
    process.exit(1)
  }
  const buffer = Buffer.from(await data.arrayBuffer())
  writeFileSync(localDest, buffer)
  console.log(localDest)
} else if (command === 'delete') {
  const [objectName] = args
  if (!objectName) {
    console.error('Usage: download-raw-captures.mjs delete <object-name>')
    process.exit(1)
  }
  const { error } = await supabase.storage.from(BUCKET).remove([objectName])
  if (error) {
    console.error(`Delete failed: ${error.message}`)
    process.exit(1)
  }
  console.log('deleted')
} else {
  console.error('Usage: download-raw-captures.mjs <list|download|delete> [args...]')
  process.exit(1)
}
```

- [ ] **Step 3: Verify `SUPABASE_URL` is set alongside the already-confirmed service-role key**

Run: `grep -c "^SUPABASE_URL=" C:\Users\gregm\jarvis-embed\.env`
Expected: `1`. If it's `0`, add `SUPABASE_URL=https://vikpcejlyxieguorwysf.supabase.co` to `C:\Users\gregm\jarvis-embed\.env` before continuing (this is the same project ID used throughout this plan and the rest of Carl's stack — not a new secret, just a project URL).

- [ ] **Step 4: End-to-end manual verification**

This is the one step in this plan that needs a real round trip through the deployed app, so do it after Task 3's page is deployed (Task 7 below), not before. Coming back to this step then:

1. Open the deployed Content Manager `/capture` page, upload a small throwaway test video (anything short — a few seconds is fine).
2. Run: `cd C:\Users\gregm\jarvis-embed && node --env-file=.env download-raw-captures.mjs list`
   Expected: one line, the uploaded object's name (timestamp-prefixed).
3. Run: `node --env-file=.env download-raw-captures.mjs download "<name from step 2>" "C:\Users\gregm\content-autopilot-work\test-download.mp4"`
   Expected: prints the local path; the file exists and has non-zero size (`Get-Item C:\Users\gregm\content-autopilot-work\test-download.mp4` should show a size > 0).
4. Run: `node --env-file=.env download-raw-captures.mjs delete "<name from step 2>"`
   Expected: prints `deleted`. Re-run `list` — the object is gone.
5. Delete the local test file: `Remove-Item C:\Users\gregm\content-autopilot-work\test-download.mp4`

- [ ] **Step 5: Commit (only if Step 1 found a tracked git repo with a remote)**

```bash
git -C C:\Users\gregm\jarvis-embed add download-raw-captures.mjs
git -C C:\Users\gregm\jarvis-embed commit -m "feat: download/delete script for Content Manager's raw-captures bucket"
git -C C:\Users\gregm\jarvis-embed push
```

---

### Task 6: Fold the bucket check into `content-autopilot`'s Step 1

**Files:** none (this is a scheduled-task prompt, edited via the `mcp__scheduled-tasks__update_scheduled_task` tool — not a file path on this machine, per this session's own discovery earlier today that `.claude/scheduled-tasks/*/SKILL.md` paths don't resolve locally in every session context).

- [ ] **Step 1: Get the current full prompt**

Call `mcp__scheduled-tasks__list_scheduled_tasks`, find the entry with `taskId: "content-autopilot"`, and use its current prompt content as the base for the edit below (fetch the current text via whatever mechanism resolves in your session — if the `path` field's local file *does* resolve for you, read it directly with the Read tool instead of guessing).

- [ ] **Step 2: Insert the bucket check into Step 1**

Immediately after the existing Step 1 paragraph that describes checking `Content Inbox` for new files (and before the "If Content Inbox has no new files..." sentence, or right after it — either placement is fine as long as both sources feed the same Step 2 loop), insert:

```
Also check Content Manager's `raw-captures` Supabase bucket for pending uploads: run `cd C:\Users\gregm\jarvis-embed && node --env-file=.env download-raw-captures.mjs list`. For each object name printed, download it into the same local working directory as Drive-sourced files: `node --env-file=.env download-raw-captures.mjs download "<object-name>" "C:\Users\gregm\content-autopilot-work\<object-name>"`. Each downloaded file becomes a candidate for Step 2 exactly like a Drive-sourced file — same duration check, same 3-strikes `.attempts` sidecar tracking (keyed by the object name), same everything. The only difference is at the end: after Step 2 successfully processes a bucket-sourced file (row inserted, Telegram card sent), delete it from the bucket instead of moving it to `Processed\`: `node --env-file=.env download-raw-captures.mjs delete "<object-name>"`. If Step 2 fails on a bucket-sourced file, leave it in the bucket (don't delete) so the next sweep retries it, same as a Drive-sourced file staying in the inbox on failure.
```

- [ ] **Step 3: Apply the update**

Call `mcp__scheduled-tasks__update_scheduled_task` with `taskId: "content-autopilot"` and `prompt:` set to the full modified text (existing content plus the insertion above — do not drop any existing step while editing).

- [ ] **Step 4: Verify**

Call `mcp__scheduled-tasks__list_scheduled_tasks` again and confirm `content-autopilot`'s entry still shows the same schedule (`13 11,18 * * *`) and `enabled: true` — an update should not have changed either. If a local path resolves for reading it back, confirm the new paragraph is present in the fetched prompt text.

---

### Task 7: Deploy and verify live

**Files:** none (deploy + manual verification)

- [ ] **Step 1: Push to trigger the existing GitHub → Vercel auto-deploy**

```bash
git -C C:\Users\gregm\content push
```

- [ ] **Step 2: Confirm the deployment is live**

Use the Vercel MCP `get_deployment` tool against Content Manager's production alias (find the exact alias via `list_projects`/`get_project` if not already known), and confirm `readyState: "READY"`.

- [ ] **Step 3: Confirm the full test suite is green**

Run: `cd C:\Users\gregm\content && npm test`
Expected: all suites pass, including the 9 new tests from Tasks 2-3 (89 pre-existing + 9 new = 98).

- [ ] **Step 4: Now go back and complete Task 5, Step 4** (the end-to-end manual verification needs the live deployed page, which now exists).

- [ ] **Step 5: One real end-to-end pass through the whole pipeline**

Upload a real (not throwaway) short clip via `/capture`. Confirm `content-autopilot`'s next scheduled run (or trigger it manually if your session can run scheduled tasks on demand) picks it up, processes it through Step 2 exactly as a Drive-sourced file would, and a Telegram card arrives. This confirms the new intake door actually feeds the existing pipeline end-to-end, not just that the bucket mechanics work in isolation.

---

## Self-Review

**Spec coverage:** Bucket + RLS (Task 1) ✅. Capture page as landing route with upload + waiting list + visible error/retry (Tasks 3-4) ✅. `content-autopilot` Step 1 addition, including the delete-on-success/retry-on-failure behavior described in the spec's error-handling section (Task 6) ✅. The spec's flagged "needs verification" item — how the scheduled task authenticates to the private bucket — resolved during planning research (Task 5): `jarvis-embed/.env` already has a real `SUPABASE_SERVICE_ROLE_KEY`, no new secret plumbing needed.

**Placeholder scan:** No TBD/TODO. Task 6 can't include a byte-exact diff against the live SKILL.md prompt (not readable from every session, discovered earlier today) — its steps direct the executor to fetch the real current text first and insert a fully-written paragraph, not a vague "add appropriate logic" instruction.

**Type/naming consistency:** `raw-captures` (bucket name) used identically across Tasks 1, 3, 5, 6. `captureObjectName`/`formatCaptureAge` (Task 2) match their usage in `Capture.tsx` (Task 3) exactly. `download-raw-captures.mjs`'s three subcommands (`list`/`download`/`delete`) are referenced identically in Task 5's own verification steps and Task 6's SKILL.md insertion.
