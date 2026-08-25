# Publish Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each scheduled content idea a user-chosen Eastern publish date/time and surface the resulting overdue, due-today, unscheduled, and current-week queue from the existing `content_ideas` lifecycle.

**Architecture:** Preserve `scheduled_at` as the existing immutable first-entry-into-`SCHEDULED` audit timestamp and add nullable `publish_at timestamptz` for the intended ship moment. A pure `publishQueue` module owns Eastern-time conversion, date bucketing, and ordering; `usePipeline` uses it to make scheduling an explicit `SCHEDULED + publish_at` transition, while the Provider remains the only `content_ideas` reader/writer. A new Queue route renders the compact seven-day view and action queue; Dashboard gets a small prominent due/overdue summary linking to it, rather than a new analytics view (existing route/provider boundaries: `src/App.tsx:15-27`, `src/hooks/useIdeas.tsx:24-98`).

**Tech Stack:** React 19, TypeScript strict, Vite, react-router-dom 7, Tailwind, Supabase JS, Vitest, oxlint.

**Freshness:** Inspected `master` at `2a39b488449deaaca537a959388d02f0717b9342` (clean worktree at inspection).

**Acceptance criteria:**

- Moving a READY idea to SCHEDULED requires an explicit valid Eastern date/time, writes it to `publish_at`, and preserves `scheduled_at` as the original one-time status-entry timestamp (source: existing first-entry behavior `src/hooks/usePipeline.ts:18-35`).
- Any existing or newly scheduled `SCHEDULED` idea with no `publish_at` appears under “Needs a publish time”; an idea with a past time appears as overdue; one on the current Eastern calendar date appears in “Ready today”; each appears in at most one queue bucket.
- `/queue` shows a compact Monday–Sunday current-week view for scheduled ideas plus the prominent action queue; Dashboard displays the non-empty overdue/today/needs-time counts with a link to `/queue` (Dashboard currently contains only pipeline, streak, lifetime, spotlight, and performance sections at `src/pages/Dashboard.tsx:11-113`).
- The queue is derived only from `IdeasProvider` data and existing `content_ideas` updates—no new planner/table, no duplicated data fetch, and no new analytics route (source: `src/hooks/useIdeas.tsx:24-98`, current routes `src/App.tsx:17-25`).
- Existing ideas remain readable after the nullable column migration; historical `scheduled_at` values are not converted into invented intended publish times.
- Focused Vitest tests, `npm test`, `npm run lint`, and `npm run build` all exit 0.

**Non-goals:**

- Do not repurpose, overwrite, backfill, or remove `scheduled_at`. It currently records the first transition to SCHEDULED; treating that operational timestamp as user intent would fabricate schedule data (source: `src/hooks/usePipeline.ts:18-35`).
- Do not add a separate scheduling table, planner, automatic publisher, social API posting, reminder/notification, recurring cadence engine, or another Analytics view.
- Do not change pipeline statuses, READY hook-gate behavior, POSTED/ TRACKED performance flow, or per-platform `content_post_performance` data (source: `src/lib/constants.ts:27-39`, `src/components/IdeaCard.tsx:15-19`, `src/pages/Analytics.tsx:122-128`).
- Do not write or alter a real content row as a verification shortcut. Production write-path testing requires a human-approved disposable target/environment.
- Do not push. The commits below are local logical-unit commits; pushing requires separate Carl authorization.

**Assumptions & unverified claims:**

- **verified-against-commit:** `scheduled_at` has no active runtime reader outside the transition/type/fixture locations inspected; no production feature currently treats it as intended publish time (writer: `src/hooks/usePipeline.ts:18-35`; type: `src/types/content.ts:5-35`).
- **verified-against-commit:** The repository deliberately has no tracked SQL migration directory; prior Content schema changes use direct Supabase MCP `apply_migration` calls (source: `docs/superpowers/specs/2026-08-20-winner-to-series-design.md:16-18`, `docs/superpowers/specs/2026-08-20-winner-to-series-design.md:28-35`).
- **verified-against-commit:** Existing `SCHEDULED` rows may have a historical `scheduled_at` but cannot be honestly backfilled with `publish_at`; they must stay null and be surfaced as “Needs a publish time.”
- **external-dependency:** The authenticated owner policy on `content_ideas` must permit the new nullable column through the existing client update path; source confirms the Provider updates that table but no live RLS/schema query was run (source: `src/hooks/useIdeas.tsx:24-80`).
- **could-not-access:** No live row count, actual `scheduled_at` values, authenticated UI session, or deployed timezone behavior was inspected.
- **decision-required-from-Carl:** The code will label the scheduling input and queue in `America/New_York`, consistent with existing Content date aggregation, but Carl should confirm that Eastern time—not the browser/device timezone—is the intended publishing-time policy before execution (existing Eastern precedent: `src/lib/chartData.ts:1-40`, `src/__tests__/chartData.test.ts:79-96`).
- **decision-required-from-Carl:** A human must name a disposable safe target/environment before any live UI schedule/reschedule or status-transition verification, because those paths update `content_ideas`.

> **Claude review notes (2026-08-25, execution + verification):** Both decision-required-from-Carl items were resolved by Carl before execution: (1) proceed with the additive migration — applied and verified live (both `scheduled_at` and `publish_at` present, nullable, no existing rows touched); (2) America/New_York confirmed as the publish-time policy. Live write-path mutation verification (Task 4 Step 3) was skipped by explicit choice, consistent with the same call made on the same-day Vessel build — the close/schedule flow is exercised by 28 passing unit/component tests instead. Task 4 Step 2's read-only UI check hit a pre-existing environment issue unrelated to this plan's diff: the local dev server (`npm run dev` via the shared preview launcher) throws `supabaseUrl is required` despite correct `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in `.env.local` — none of this plan's files touch `src/lib/supabase.ts` or env loading. Recorded as **could-not-access** per this plan's own convention rather than forcing a workaround outside the plan's scope. All automated checks passed: `npm test` (171/171), `npm run lint` (pre-existing warnings only, none in touched files), `npm run build` (clean).

### Task 1: Add the durable intended-publish field and pure queue semantics

**Files:**

- Modify: Supabase project `vikpcejlyxieguorwysf` via its existing `apply_migration` workflow (no repository migration file)
- Modify: `C:\Users\gregm\content\src\types\content.ts`
- Create: `C:\Users\gregm\content\src\lib\publishQueue.ts`
- Test: `C:\Users\gregm\content\src\__tests__\publishQueue.test.ts`
- Modify: `C:\Users\gregm\content\src\pages\Ideas.tsx`
- Modify: `C:\Users\gregm\content\src\pages\Intel.tsx`
- Modify: `C:\Users\gregm\content\src\components\WinnerSignals.tsx`
- Modify: `C:\Users\gregm\content\src\__tests__\chartData.test.ts`
- Modify: `C:\Users\gregm\content\src\__tests__\experiments.test.ts`
- Modify: `C:\Users\gregm\content\src\__tests__\hookGate.test.ts`
- Modify: `C:\Users\gregm\content\src\__tests__\IdeaCard.test.tsx`
- Modify: `C:\Users\gregm\content\src\__tests__\IdeaDetailModal.test.tsx`
- Modify: `C:\Users\gregm\content\src\__tests__\PillarStageBreakdown.test.tsx`
- Modify: `C:\Users\gregm\content\src\__tests__\SpotlightCard.test.tsx`
- Modify: `C:\Users\gregm\content\src\__tests__\winners.test.ts`

- [ ] **Step 1: Apply the additive schema migration once through the established Supabase migration mechanism.** Use the authenticated Content Supabase MCP `apply_migration` capability described by the existing repository spec, naming it `add_content_idea_publish_at` and applying exactly:

  ```sql
  alter table content_ideas
    add column publish_at timestamptz null;
  ```

  This is an additive nullable column, so existing rows continue to load and no backfill/drop occurs. After it completes, use a read-only schema query (for example `select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'content_ideas' and column_name in ('scheduled_at', 'publish_at')`) to confirm both columns exist and are nullable. Do not update any real `content_ideas` row during verification.

- [ ] **Step 2: Add the type field and fixture/create defaults.** Insert `publish_at: string | null` immediately after `scheduled_at` in `ContentIdea` (`src/types/content.ts:5-35`). Because `NewContentIdea` omits only `id` and `created_at`, add `publish_at: null` beside every existing `scheduled_at: null` literal in the listed Ideas/Intel/WinnerSignals writers and test factories. Do not make the field optional: strict typing must force every constructed idea to state whether it has a publish target.

- [ ] **Step 3: Write the failing queue-logic tests.** Define the Task 1 interfaces in `src/lib/publishQueue.ts` before implementing them:

  ```ts
  export const CONTENT_TIME_ZONE = 'America/New_York'
  export type PublishQueueItem = { idea: ContentIdea; publishAt: Date | null }
  export type PublishQueue = {
    todayKey: string
    weekKeys: string[]
    overdue: PublishQueueItem[]
    today: PublishQueueItem[]
    upcoming: PublishQueueItem[]
    needsTime: PublishQueueItem[]
  }
  export function publishInputToIso(value: string): string | null
  export function isoToPublishInput(value: string | null): string
  export function buildPublishQueue(ideas: ContentIdea[], now?: Date): PublishQueue
  ```

  In `src/__tests__/publishQueue.test.ts`, use fixture `ContentIdea` objects only. Cover: a past Eastern date is overdue; a same-Eastern-date future time is today; a later current-week item is upcoming and placed in its correct Monday–Sunday `weekKeys` slot; `SCHEDULED + null publish_at` is needsTime; non-SCHEDULED rows are excluded; malformed dates are needsTime; no item belongs to two buckets; `publishInputToIso` rejects an empty/nonexistent local value and `isoToPublishInput` round-trips a valid ISO at minute precision. Fix `now` to `2026-08-25T16:00:00.000Z` for deterministic results.

- [ ] **Step 4: Run the focused test before implementation.** Run:

  ```powershell
  cd C:\Users\gregm\content
  npm test -- src/__tests__/publishQueue.test.ts
  ```

  Expected result: Vitest exits non-zero because `@/lib/publishQueue` does not exist. Do not add an empty placeholder module to bypass this red phase.

- [ ] **Step 5: Implement the complete pure queue module.** Create `src/lib/publishQueue.ts` with the following contract-preserving code. `publishInputToIso` interprets the native `datetime-local` value as Eastern wall-clock time, verifies it round-trips through `Intl`, and returns null for malformed or DST-gap inputs; `buildPublishQueue` uses the same Eastern calendar convention rather than browser/UTC date boundaries.

  ```ts
  import type { ContentIdea } from '@/types/content'

  export const CONTENT_TIME_ZONE = 'America/New_York'
  export type PublishQueueItem = { idea: ContentIdea; publishAt: Date | null }
  export type PublishQueue = {
    todayKey: string
    weekKeys: string[]
    overdue: PublishQueueItem[]
    today: PublishQueueItem[]
    upcoming: PublishQueueItem[]
    needsTime: PublishQueueItem[]
  }

  type DateParts = { year: number; month: number; day: number; hour: number; minute: number }

  function easternParts(date: Date): DateParts {
    const values = new Intl.DateTimeFormat('en-US', {
      timeZone: CONTENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(values.find(part => part.type === type)?.value)
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') }
  }

  function key(parts: Pick<DateParts, 'year' | 'month' | 'day'>): string {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  }

  function addDays(dateKey: string, days: number): string {
    const date = new Date(`${dateKey}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }

  function mondayKey(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00Z`)
    const mondayOffset = (date.getUTCDay() + 6) % 7
    return addDays(dateKey, -mondayOffset)
  }

  function parseInput(value: string): DateParts | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
    if (!match) return null
    const [, year, month, day, hour, minute] = match
    const parts = { year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: Number(minute) }
    if (!Number.isInteger(parts.year) || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31 || parts.hour > 23 || parts.minute > 59) return null
    const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
    return calendar.getUTCFullYear() === parts.year && calendar.getUTCMonth() === parts.month - 1 && calendar.getUTCDate() === parts.day ? parts : null
  }

  export function publishInputToIso(value: string): string | null {
    const desired = parseInput(value)
    if (!desired) return null
    const desiredUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute)
    let instant = desiredUtc
    for (let attempt = 0; attempt < 3; attempt++) {
      const actual = easternParts(new Date(instant))
      const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
      const delta = desiredUtc - actualUtc
      if (delta === 0) return new Date(instant).toISOString()
      instant += delta
    }
    return null
  }

  export function isoToPublishInput(value: string | null): string {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const parts = easternParts(date)
    return `${key(parts)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
  }

  function validPublishAt(value: string | null): Date | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  export function buildPublishQueue(ideas: ContentIdea[], now = new Date()): PublishQueue {
    const todayKey = key(easternParts(now))
    const monday = mondayKey(todayKey)
    const weekKeys = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
    const queue: PublishQueue = { todayKey, weekKeys, overdue: [], today: [], upcoming: [], needsTime: [] }

    for (const idea of ideas) {
      if (idea.status !== 'SCHEDULED') continue
      const publishAt = validPublishAt(idea.publish_at)
      const item = { idea, publishAt }
      if (!publishAt) { queue.needsTime.push(item); continue }
      const publishKey = key(easternParts(publishAt))
      if (publishAt.getTime() < now.getTime()) queue.overdue.push(item)
      else if (publishKey === todayKey) queue.today.push(item)
      else queue.upcoming.push(item)
    }

    const sortByPublish = (a: PublishQueueItem, b: PublishQueueItem) => (a.publishAt?.getTime() ?? 0) - (b.publishAt?.getTime() ?? 0)
    queue.overdue.sort(sortByPublish)
    queue.today.sort(sortByPublish)
    queue.upcoming.sort(sortByPublish)
    queue.needsTime.sort((a, b) => a.idea.created_at.localeCompare(b.idea.created_at))
    return queue
  }
  ```

- [ ] **Step 6: Run the focused test after implementation.** Run the same command from Step 4. Expected result: Vitest reports all publish-queue cases passed and exits 0.

- [ ] **Step 7: Commit the migration-adjacent model and tested queue logic locally.** Run:

  ```powershell
  cd C:\Users\gregm\content
  git add src/types/content.ts src/lib/publishQueue.ts src/__tests__/publishQueue.test.ts src/pages/Ideas.tsx src/pages/Intel.tsx src/components/WinnerSignals.tsx src/__tests__/chartData.test.ts src/__tests__/experiments.test.ts src/__tests__/hookGate.test.ts src/__tests__/IdeaCard.test.tsx src/__tests__/IdeaDetailModal.test.tsx src/__tests__/PillarStageBreakdown.test.tsx src/__tests__/SpotlightCard.test.tsx src/__tests__/winners.test.ts
  git commit -m "feat: add intended publish time queue model"
  ```

### Task 2: Require a publish time when entering SCHEDULED

**Files:**

- Create: `C:\Users\gregm\content\src\components\ScheduleIdeaModal.tsx`
- Modify: `C:\Users\gregm\content\src\hooks\usePipeline.ts`
- Modify: `C:\Users\gregm\content\src\components\IdeaCard.tsx`
- Modify: `C:\Users\gregm\content\src\pages\Pipeline.tsx`
- Modify: `C:\Users\gregm\content\src\pages\Ideas.tsx`
- Test: `C:\Users\gregm\content\src\__tests__\ScheduleIdeaModal.test.tsx`
- Test: `C:\Users\gregm\content\src\__tests__\IdeaCard.test.tsx`

- [ ] **Step 1: Define the scheduling interfaces produced by this task.** `usePipeline()` must continue to expose the existing `moveStage(id, status)` behavior and additionally expose `scheduleIdea(id: string, publishInput: string): Promise<void>`. `scheduleIdea` calls Task 1's `publishInputToIso`; it rejects a null conversion before any Provider update; otherwise it writes `{ status: 'SCHEDULED', publish_at: iso }` and writes `scheduled_at: new Date().toISOString()` only when the in-memory idea has no historical `scheduled_at`. `ScheduleIdeaModal` consumes `{ idea, onClose, onSchedule }`, with `onSchedule` typed `(id: string, publishInput: string) => Promise<void>`.

- [ ] **Step 2: Write the failing component tests.** In `ScheduleIdeaModal.test.tsx`, test that an empty datetime input cannot submit, a valid value invokes `onSchedule(idea.id, value)`, and a rejected `onSchedule` keeps the modal open and displays its error. In `IdeaCard.test.tsx`, add a READY-card case proving the old direct `onMove(id, 'SCHEDULED')` path is not called; instead its Schedule control invokes the passed `onScheduleRequest(idea)` callback. This prevents a status-only SCHEDULED transition from bypassing the required time.

- [ ] **Step 3: Run the focused red tests.** Run:

  ```powershell
  cd C:\Users\gregm\content
  npm test -- src/__tests__/ScheduleIdeaModal.test.tsx src/__tests__/IdeaCard.test.tsx
  ```

  Expected result: Vitest exits non-zero because `ScheduleIdeaModal` and the new `IdeaCard` scheduling prop do not exist yet.

- [ ] **Step 4: Implement `scheduleIdea` and the scheduling modal.** In `usePipeline.ts`, import `publishInputToIso` from Task 1, define `scheduleIdea` exactly to preserve `scheduled_at` while setting `publish_at`, and return it from the hook. In `ScheduleIdeaModal.tsx`, render a modal matching `IdeaDetailModal`'s overlay/accessibility pattern (source: `src/components/IdeaDetailModal.tsx:42-61`), label the control `Publish time (Eastern)`, use `type="datetime-local"`, initialize a re-schedule from `isoToPublishInput(idea.publish_at)`, show a concrete validation message for an empty/invalid DST value, and await the injected `onSchedule` before closing.

- [ ] **Step 5: Route all existing Ready → Scheduled entry points through the modal.** Change `IdeaCard` so `nextStage === 'SCHEDULED'` renders `Schedule →` and calls its new required `onScheduleRequest(idea)` prop; keep all other stage buttons using `onMove` and preserve the READY hook gate (source: `src/components/IdeaCard.tsx:15-70`). In both `Pipeline.tsx` and `Ideas.tsx`, add `scheduleTarget` state, pass `onScheduleRequest={setScheduleTarget}`, render `ScheduleIdeaModal` when a target exists, and pass `scheduleIdea` from `usePipeline`. In `Ideas.tsx`, replace its current direct `update(id, { status })` card movement with `usePipeline().moveStage`, so Ideas can no longer bypass the historical-timestamp/publish-time contract (source: `src/pages/Ideas.tsx:33-35`, `src/pages/Ideas.tsx:130-135`).

- [ ] **Step 6: Run the focused green tests.** Run the Step 3 command. Expected result: all scheduling-modal and IdeaCard tests pass, including the no-bypass assertion.

- [ ] **Step 7: Commit the scheduling interaction locally.** Run:

  ```powershell
  cd C:\Users\gregm\content
  git add src/hooks/usePipeline.ts src/components/ScheduleIdeaModal.tsx src/components/IdeaCard.tsx src/pages/Pipeline.tsx src/pages/Ideas.tsx src/__tests__/ScheduleIdeaModal.test.tsx src/__tests__/IdeaCard.test.tsx
  git commit -m "feat: require publish time when scheduling content"
  ```

### Task 3: Surface the queue on a dedicated operational route and Dashboard

**Files:**

- Create: `C:\Users\gregm\content\src\pages\PublishQueue.tsx`
- Create: `C:\Users\gregm\content\src\components\PublishQueueSummary.tsx`
- Modify: `C:\Users\gregm\content\src\App.tsx`
- Modify: `C:\Users\gregm\content\src\components\Layout.tsx`
- Modify: `C:\Users\gregm\content\src\pages\Dashboard.tsx`
- Test: `C:\Users\gregm\content\src\__tests__\PublishQueueSummary.test.tsx`

- [ ] **Step 1: Write the failing Dashboard-summary test.** Render `PublishQueueSummary` with fixed fixture ideas and an injected `now`. Assert that it returns `null` for no SCHEDULED ideas, renders distinct count/copy for overdue, ready today, and needs-time rows, and links to `/queue`. Include an assertion that a future-week item alone does not create a prominent Dashboard card.

- [ ] **Step 2: Run the focused red test.** Run:

  ```powershell
  cd C:\Users\gregm\content
  npm test -- src/__tests__/PublishQueueSummary.test.tsx
  ```

  Expected result: Vitest exits non-zero because `PublishQueueSummary` has not been created.

- [ ] **Step 3: Implement the reusable summary and Queue route.** `PublishQueueSummary` receives `ideas: ContentIdea[]` and optional `now`, calls Task 1's `buildPublishQueue`, returns `null` only when overdue/today/needsTime are all empty, and renders a compact warning/action card with a `Link` to `/queue`. `PublishQueue.tsx` obtains `ideas` and `loading` only from `useIdeas`, calls `buildPublishQueue`, then renders:

  1. an action section ordered **Overdue**, **Ready today**, **Needs a publish time**;
  2. a compact Monday-through-Sunday grid using `weekKeys`, where each day shows scheduled items whose `publish_at` Eastern date equals that key; and
  3. a later-upcoming list for scheduled items outside the current week.

  Use `Intl.DateTimeFormat` with `timeZone: CONTENT_TIME_ZONE` for all labels, reuse existing card/border/Tailwind vocabulary, and give each row title, platform, pillar, and an `Edit schedule` control that opens the Task 2 `ScheduleIdeaModal` with `scheduleIdea`. Do not fetch Supabase directly in either component.

- [ ] **Step 4: Wire navigation and prominent Dashboard placement.** Add `PublishQueue` import and `<Route path="/queue" element={<PublishQueue />} />` in `App.tsx` next to the existing operational routes (source: `src/App.tsx:17-25`). Add `{ to: '/queue', label: 'Queue' }` to `Layout.tsx`'s navigation list (source: `src/components/Layout.tsx:5-12`). In `Dashboard.tsx`, render `<PublishQueueSummary ideas={ideas} />` immediately after the `h1` and before the existing pipeline summary so overdue/today work is visible before aggregate analytics (source: `src/pages/Dashboard.tsx:11-34`).

- [ ] **Step 5: Run the focused green test.** Run the Step 2 command. Expected result: all summary cases pass and Vitest exits 0.

- [ ] **Step 6: Commit the operational queue surfaces locally.** Run:

  ```powershell
  cd C:\Users\gregm\content
  git add src/pages/PublishQueue.tsx src/components/PublishQueueSummary.tsx src/App.tsx src/components/Layout.tsx src/pages/Dashboard.tsx src/__tests__/PublishQueueSummary.test.tsx
  git commit -m "feat: add content publishing queue"
  ```

### Task 4: Run regressions and verify without mutating production content

**Files:**

- Test: `C:\Users\gregm\content\src\__tests__\publishQueue.test.ts`
- Test: `C:\Users\gregm\content\src\__tests__\ScheduleIdeaModal.test.tsx`
- Test: `C:\Users\gregm\content\src\__tests__\PublishQueueSummary.test.tsx`
- Test: `C:\Users\gregm\content\package.json`

- [ ] **Step 1: Run all automated checks from the native checkout.** Run:

  ```powershell
  cd C:\Users\gregm\content
  npm test
  npm run lint
  npm run build
  ```

  Expected result: all commands exit 0. `package.json` defines `npm test` as `vitest run`, lint as `oxlint`, and build as `tsc -b && vite build` (source: `package.json:6-12`).

- [ ] **Step 2: Perform a read-only UI check against existing safe data.** Without creating, editing, rescheduling, moving, or deleting a real idea, open the authenticated application and inspect `/queue` and Dashboard. Confirm navigation works, no-data states are legible, the week grid aligns Monday–Sunday, and any already-existing SCHEDULED rows with `publish_at` display in the expected bucket. If no safe existing row covers a state, report it as **could-not-access**; do not manufacture coverage with a live row.

- [ ] **Step 3: Gate live mutation verification on Carl's safe-target decision.** This is intentionally `decision-required-from-Carl`: before verifying initial schedule, reschedule, or READY → SCHEDULED persistence in a real environment, obtain Carl's explicit disposable target/environment and permission. If granted, verify only the named target; otherwise hand off the unit-test/build evidence and record the skipped live mutation check.

- [ ] **Step 4: Review the final change boundary.** Run:

  ```powershell
  cd C:\Users\gregm\content
  git status --short
  git log --oneline -3
  git diff HEAD~3..HEAD -- src/types/content.ts src/lib/publishQueue.ts src/hooks/usePipeline.ts src/components/ScheduleIdeaModal.tsx src/components/IdeaCard.tsx src/components/PublishQueueSummary.tsx src/pages/Ideas.tsx src/pages/Pipeline.tsx src/pages/PublishQueue.tsx src/pages/Dashboard.tsx src/App.tsx src/components/Layout.tsx src/__tests__
  ```

  Confirm the changes remain inside the `content_ideas` model/Provider UI path; no Analytics route, `content_post_performance` schema, posting API, or separate planner/table changed. Preserve and report unrelated worktree changes.

- [ ] **Step 5: Hand off without pushing.** Record the three local commit SHAs, migration name/read-only schema result, automated command results, read-only UI observations, and whether Carl authorized a safe write-path test. Do not run `git push`.
