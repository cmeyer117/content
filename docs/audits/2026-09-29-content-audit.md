# Content Manager — Code Audit

**Date:** 2026-09-29
**Auditor:** Dev (Fable) agent, read-only
**Commit audited:** `b1c3051` (branch `mc/b9650f27`)
**Scope:** whole repo — `api/`, `src/`, `public/`, `.github/workflows/`, `docs/superpowers/` specs vs. what is wired. Commits since 2026-09-08 weighted most heavily.

## Method and limits

- Static read of every tracked source file. No source file was changed.
- **The test suite was not run.** This worktree has no `node_modules`, and installs were out of scope. One attempt to run it against the main checkout's existing Vitest install failed at config load (`Cannot find package 'vitest'`). Every statement below about test coverage comes from reading the test files, not from executing them.
- **The database was not inspected.** The repo contains no `.sql` migrations or RLS policy definitions (the draft-sync spec confirms this is the convention: `docs/superpowers/specs/2026-09-09-metricool-draft-sync-design.md:33`). Anything about schema, constraints, indexes, RLS policies, or Vercel/GitHub environment variables is marked **unverified**.
- No network calls were made.

## Commits since 2026-09-08

| Commit | Date | Change | Findings |
|---|---|---|---|
| `b1c3051` | 09-22 | Next-post brief from tracked performance | P2-1, P2-2, P2-3 |
| `f7a4a90` | 09-18 | Confirm before deleting an idea | P1-7, P2-9 |
| `c265fd1` | 09-18 | Realtime refetch no longer toggles `loading` | P1-6, P2-5, P2-6 |
| `725fc48` | 09-15 | DB-enforced dedup for ingest endpoint | P1-2, P1-3, P2-10 |
| `42d1ed6` | 09-15 | `moveStage('POSTED')` creates performance rows | P2-4 |
| `3e32fd0` | 09-09 | Metricool draft-sync design spec | P2-13 |

---

## P0 findings

**None confirmed from the code.**

Two P1 findings become P0 if their unverified condition holds, and each takes minutes to check outside the repo:

- P1-1 becomes P0 if `CRON_SECRET` is unset in any Vercel environment that has `SUPABASE_SERVICE_ROLE_KEY` set.
- P1-2 becomes P0 for the ingest path if the `source_key` index was created as a partial index, as the code comment says.

---

## P1 findings

### P1-1. Cron-secret check fails open when `CRON_SECRET` is unset

**Evidence:** `api/ingest-content-ideas.js:43-44`, `api/send-posting-cadence-nudge.js:91-92`

```js
const secret = req.headers['authorization']?.replace('Bearer ', '');
if (secret !== process.env.CRON_SECRET) { ... 401 }
```

With no `Authorization` header, `secret` is `undefined`. If `process.env.CRON_SECRET` is also `undefined`, the comparison is `undefined !== undefined`, which is `false`, so the request is treated as authorized.

**Failure scenario:** `CRON_SECRET` is set for Production only, and `SUPABASE_SERVICE_ROLE_KEY` is set for all environments. Anyone who reaches a Preview deployment URL can `POST /api/ingest-content-ideas` with no header and insert arbitrary rows into `content_ideas` through the service-role key, which bypasses RLS. Because `insertIdeas` spreads the caller's object straight into the row (`api/ingest-content-ideas.js:12`), the caller controls every column.

**Unverified:** which Vercel environments have which variables, and whether Vercel deployment protection covers Preview URLs.

**Also:** the comparison is not constant-time, and an empty-string `CRON_SECRET` would match a bare `Bearer ` header.

### P1-2. Ingest upsert targets a partial unique index, which `on_conflict=source_key` cannot use

**Evidence:** `api/ingest-content-ideas.js:8-13` (comment says "partial unique index"; request uses `?on_conflict=source_key` with `resolution=ignore-duplicates`); commit `725fc48` message: "depends on the content_ideas.source_key column + partial unique index migration... Pushing before the migration lands would break every real request to this endpoint."

PostgREST turns `on_conflict=source_key` into `ON CONFLICT (source_key) DO NOTHING`. Postgres only infers a partial unique index when the `ON CONFLICT` clause repeats the index predicate, and PostgREST has no way to send one. Against a partial index the statement fails with error `42P10` ("no unique or exclusion constraint matching the ON CONFLICT specification").

**Failure scenario:** the migration was applied exactly as described. Every call to the endpoint returns 500 with the Postgres error, and no ideas are ingested. The test suite cannot catch this because `fetch` is mocked (`api/ingest-content-ideas.test.js:21-25`).

**Unverified:** whether the migration was applied at all, and whether the index is partial or a plain unique index. If the column does not exist, every request also fails. The failure is loud to the caller (500 plus message), which is why this is P1 and not P0.

### P1-3. Ingest dedup no longer matches rows that have no `source_key`

**Evidence:** `api/ingest-content-ideas.js:12-13`. The removed code (visible in `git show 725fc48`) matched incoming titles against **all** existing `content_ideas` titles. The new code only conflicts on `source_key = 'ingest:<title>'`.

**Failure scenario:** the 26 ideas in `scripts/data/row-exercise-ideas.json` were ingested before 2026-09-15, so they have no `source_key`. Re-posting the same file inserts 26 duplicates, and the response reports `inserted: 26, existing: 0`. The same applies to any idea typed into the app and later sent through ingest.

**Unverified:** whether the migration backfilled `source_key` for existing rows.

**Related:** the key uses the raw title, so `"Hammer curls"` and `"Hammer curls "` are different keys, even though validation trims (`api/ingest-content-ideas.js:31`).

### P1-4. The posting nudge can stop permanently with a green workflow

**Evidence:**
- `api/send-posting-cadence-nudge.js:36-41` — `fetchSubscriptions` never checks `r.ok`.
- `api/send-posting-cadence-nudge.js:58-61` — `if (!subs.length)` returns 200 "No subscriptions, no push sent".
- `.github/workflows/posting-cadence-nudge.yml:27-28` — the workflow only checks `sent`/`total` when the message is `Pushed`.
- `api/send-posting-cadence-nudge.js:79` — a 410 response deletes the subscription row.
- `src/components/PushSubscribeButton.tsx:22-24,61` — the button hides itself forever once `localStorage['content_push_subscribed_v2']` is set.

**Failure scenario A:** the browser's push subscription expires. The next run gets a 410 and deletes the row; that one run fails, which is correct. Every later run finds zero subscriptions, returns 200, and the workflow is green. On the device, the localStorage flag is still set, so the "Enable Notifications" button never reappears. Nudges stop with no alert and no in-app way to re-subscribe.

**Failure scenario B:** the Supabase request for subscriptions fails (rotated key, outage). `r.json()` returns an error object, `subs.length` is `undefined`, and the function reports "No subscriptions" with status 200.

### P1-5. "Plan This Week" schedules today at 2:00 PM even when that time has passed

**Evidence:** `src/lib/planWeek.ts:9,27,34`. `openDays` keeps every day `>= todayKey`, and each placed idea gets `${day}T14:00`. Nothing compares 14:00 with the current time. The only test clock is noon Eastern (`src/__tests__/planWeek.test.ts:21`), so the case is untested.

**Failure scenario:** Carl plans the week at 6 PM Eastern on a Tuesday with nothing scheduled that day. The first selected idea gets Tuesday 2:00 PM. `buildPublishQueue` immediately files it under Overdue (`src/lib/publishQueue.ts:92`), while the result text says "Scheduled 1 — one per open day" (`src/pages/PublishQueue.tsx:117`).

### P1-6. A failed load looks like an empty account, and the error never clears

**Evidence:**
- `src/hooks/useIdeas.tsx:43-45` sets `error` on failure; nothing ever sets it back to `null`.
- No page reads it: `src/pages/Ideas.tsx:45`, `src/pages/Dashboard.tsx:11`, `src/pages/Analytics.tsx:113`, `src/pages/PublishQueue.tsx:127`, `src/pages/Pipeline.tsx:12` all destructure without `error`.

**Failure scenario:** the Supabase session expires or the network drops during load. Ideas shows "No ideas yet. Add one above." (`src/pages/Ideas.tsx:147-149`), Dashboard shows zeros, and Queue shows "Nothing needs action right now." A background refetch that fails (`c265fd1` path) leaves stale data on screen with no indication.

### P1-7. Most write failures are unhandled and invisible

**Evidence:**
- `src/pages/Ideas.tsx:54-64` — `add` failure: `try/finally` with no `catch`.
- `src/pages/Ideas.tsx:141-142` and `src/pages/Pipeline.tsx:37-38` — `moveStage` and `remove` promises are dropped.
- `src/components/IdeaDetailModal.tsx:39-67` — save failure: no `catch`, no message.
- `src/pages/Analytics.tsx:118-135,254` — `handleSave` has no `catch`.
- `src/pages/Intel.tsx:35-69,116` — `handleAdd` has no `catch`.

`PublishQueue.tsx:17-27`, `ScheduleIdeaModal.tsx:23-30`, and `WinnerSignals.tsx` do handle failures, so the pattern already exists in the repo.

**Failure scenario:** Carl clicks "Move → POSTED" on a Pipeline card while offline. The promise rejects, the card does not move, and nothing is shown. He assumes it was recorded; the 5:30 PM nudge fires anyway and the streak grid shows a gap.

---

## P2 findings

### P2-1. Next-post brief can name a "top pillar" from a single post

**Evidence:** `src/lib/nextPostBrief.ts:8,31-46,114-117`. The 3-post minimum applies to the total, not per group.

**Failure scenario:** three tracked posts — two Training at 900 and 1,100 views, one Faith at 40,000. The brief reports "Faith is your top pillar right now (median 40,000 views across 1 post)". One outlier steers the next post.

### P2-2. Next-post brief mixes platforms and claims recency it does not apply

**Evidence:**
- `src/lib/nextPostBrief.ts:114` uses `flattenPerformances`, so a `both` idea contributes a TikTok entry and an Instagram entry to the same median. `src/lib/winners.ts:44-48` deliberately separates platforms.
- `src/lib/nextPostBrief.ts:81-83,108` says "what's been working recently", but `84-92` has no date filter.
- Commit `b1c3051` is titled "from tracked Metricool performance", but the module reads only `views` and none of the `metricool_*` fields (`src/types/content.ts:65-70`).

**Failure scenario:** Instagram views run several times lower than TikTok. A pillar posted mostly to Instagram ranks below one posted mostly to TikTok, regardless of how each did relative to its own platform.

### P2-3. Next-post brief crashes the Ideas page on an unknown pillar

**Evidence:** `src/lib/nextPostBrief.ts:42` — `PILLARS.find(...)!.label`. `src/components/PillarBadge.tsx:7-9` handles the same case defensively. There is no error boundary anywhere in `src/`.

**Failure scenario:** a row arrives through the ingest endpoint with `pillar: "nutrition"` and later reaches TRACKED with views. `/ideas` throws during render and shows a blank page.

**Unverified:** whether the database has a check constraint or enum on `pillar`.

### P2-4. Move to POSTED is two separate writes

**Evidence:** `src/hooks/usePipeline.ts:40-46` — performance upserts first, then the idea update.

**Failure scenario:** the upserts succeed and the idea update fails. The idea stays SCHEDULED with `posted_at` null, but performance rows now carry a `posted_at`. `postedDaysSet` and `sumViewsByWeek` do not filter on status (`src/lib/chartData.ts:83-84,106-113`), so the streak grid shows a post, while the nudge endpoint (which reads `content_ideas.posted_at`) says nothing was posted.

**Related, unverified:** ideas moved to POSTED before the 2026-09-15 fix have `posted_at` set and no performance rows. The `!idea.posted_at` guard means they never get one through this path. No backfill exists in the repo.

### P2-5. Edit modal saves every field from a snapshot taken when it opened

**Evidence:** `src/components/IdeaDetailModal.tsx:20-37,42-62`; snapshot held in `src/pages/Ideas.tsx:51` and `src/pages/Pipeline.tsx:15`. Since `c265fd1` the modal stays mounted across realtime refetches, so the snapshot can be older than the list behind it.

**Failure scenario:** the modal is open on an idea while another session or an external job updates that idea's `body`. Carl edits only the score and saves; the older `body` overwrites the newer one.

**Also in this file:** an empty title can be saved (`:43`, no validation). Changing `platform` from `both` to `tiktok` after posting leaves the Instagram performance row in place, and it still counts in every chart.

### P2-6. Realtime refetches are full-table, undebounced, and unsequenced

**Evidence:** `src/hooks/useIdeas.tsx:37-47,51-62`. Every change event on either table reloads both tables with `select('*')` and no limit.

**Failure scenario:** marking a `both` idea as posted produces three events and three full reloads. If responses arrive out of order, an older result overwrites a newer one; `WinnerSignals.tsx:66-75` already documents this. Separately, once either table passes PostgREST's row cap, results are silently truncated (**unverified:** the project's configured cap; the default is 1,000).

### P2-7. Analytics metric inputs cannot be cleared, and a URL-only save marks the post TRACKED

**Evidence:** `src/pages/Analytics.tsx:245` — `Number(e.target.value)` turns an empty input into `0`. `src/pages/Analytics.tsx:128-129` — any save sets status to TRACKED.

**Failure scenario:** Carl types a views number, deletes it, and saves. The row stores `views: 0`. `generateNextPostBrief` and `detectWinners` filter on `views !== null`, so the zero enters both medians.

### P2-8. Nudge endpoint: unchecked responses and smaller gaps

**Evidence and scenarios:**
- `api/send-posting-cadence-nudge.js:18-24` — no `r.ok` check. On a Supabase error, `hasPostedToday` throws `some is not a function`; the handler has no `try/catch` (`:96`), so the workflow fails with an opaque 500.
- `:26-34` — a failed count request produces "0 ideas banked, ship one." The request also downloads every matching id to obtain a count.
- `:79` — only status 410 removes a subscription. A 404 from the push service stays in the table and fails the workflow every night.
- `:80` — `new URL(sub.endpoint)` inside the `catch` throws on a malformed endpoint and aborts the loop. `api/subscribe-push.js:16-17` does not validate that `endpoint` is a URL.
- `src/hooks/usePipeline.ts:41` — `posted_at` is the time of the click, not the time of the post. Marking yesterday's post this morning suppresses tonight's nudge and puts the post on the wrong day in the streak grid.
- `.github/workflows/posting-cadence-nudge.yml:5-7` — fixed UTC cron. After 2026-11-01 it fires at 4:30 PM Eastern.

### P2-9. Delete confirmation does not mention performance data

**Evidence:** `src/components/IdeaCard.tsx:34`; `src/hooks/useIdeas.tsx:84-88`.

**Failure scenario:** Carl deletes a TRACKED idea. Either its performance rows are deleted with it, removing it from every median and chart, or the delete is rejected by a foreign key and fails silently (see P1-7).

**Unverified:** the foreign key's delete behavior.

### P2-10. Ingest endpoint accepts any columns and any row shape

**Evidence:** `api/ingest-content-ideas.js:12,28-33`.

**Failure scenarios:** a caller sets `status: "TRACKED"` or `id` directly. An array containing `null` throws a `TypeError` that is returned as a 500 instead of a 400. Rows with different key sets in one batch may be rejected by PostgREST as a whole (**unverified**).

### P2-11. Experiments and Intel hooks swallow load errors

**Evidence:** `src/hooks/useExperiments.ts:11` ignores `error`; `src/hooks/useIntel.ts:19` ignores `creatorsRes.error`.

**Failure scenario:** the experiments load fails, `active` is `null`, and Analytics shows the "Start Experiment" form (`src/pages/Analytics.tsx:59`) while an experiment is already active. Carl starts a second one; ideas tagged to the first drop out of view.

**Unverified:** whether the database enforces a single active experiment.

### P2-12. Intel "Add to Ideas" can create duplicates

**Evidence:** `src/pages/Intel.tsx:30,68,117`. The `added` flag is component state and is set only after the insert resolves.

**Failure scenario:** a double-click inserts two ideas. After a reload the button is enabled again, although `source_intel_insight_id` on existing ideas already records that the insight was used.

### P2-13. Specced but not built or not wired

| Item | Evidence | State |
|---|---|---|
| Metricool draft sync | Spec `docs/superpowers/specs/2026-09-09-metricool-draft-sync-design.md:19-37`; no `api/metricool-schedule.js`; `src/hooks/usePipeline.ts:55-64` has no sync call | Not started. The spec notes it needs Metricool's Advanced plan (`:21`), which falls under the no-paid-spend rule. |
| Capture compression | `src/lib/videoCompress.ts` is imported by nothing except its test; reverted in `5c3eb26` | Parked on purpose. `/capture` is still the default route (`src/App.tsx:19`) and its copy (`src/pages/Capture.tsx:61-64`) does not mention the size ceiling (about 50 MB per the compression spec). |
| Schema and RLS in version control | No `.sql` files tracked | No way to review, reproduce, or roll back policy changes from the repo. |
| Server environment variables | `.env.example:1-2` lists only the two `VITE_` values | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` are undocumented. |

### P2-14. Capture list hides errors and may hide new uploads

**Evidence:** `src/pages/Capture.tsx:17-18` returns silently on a list error. `list()` is called with no options.

**Failure scenario:** the list call fails and the page shows "Nothing waiting." under an upload that succeeded. Separately, object names start with a timestamp (`src/lib/captureLogic.ts:4-7`); if the library's default listing is name-ascending with a page limit, the newest uploads are the first to fall off the list once the bucket grows (**unverified:** library defaults, and whether the sweep removes processed files).

### P2-15. Dead code and stale docs

| Item | Evidence |
|---|---|
| `videoCompress.ts` and both `@ffmpeg/*` dependencies | `src/lib/videoCompress.ts`; `package.json:15-16` |
| `refresh` on the ideas context, used by no consumer | `src/hooks/useIdeas.tsx:13,104` |
| `scripts/data/row-exercise-ideas.json`, whose ingest script was deleted | No reference outside `docs/` |
| `CACHE` constant in a service worker that caches nothing | `public/sw.js:1,8` |
| README lists pipeline stages that do not exist and omits the Capture and Queue pages | `README.md:9-13` vs `src/types/content.ts:3` |
| Supabase project URL hardcoded in three server files while the client reads it from env | `api/ingest-content-ideas.js:5`, `api/send-posting-cadence-nudge.js:9`, `api/subscribe-push-logic.js:1` |

### P2-16. Test and CI gaps

- CI runs build and tests but not `npm run lint` (`.github/workflows/content-ci.yml:16-18`).
- No test covers either cron handler's auth check, so P1-1 is untested.
- `handleSendPostingCadenceNudgeRequest` and `api/subscribe-push.js` have no handler-level tests; only their pure helpers do.
- `useIdeas` has two tests (`src/__tests__/useIdeas.test.tsx:38,50`); `add`, `update`, `remove`, `savePerformance`, and the error path are untested.
- No tests for `AuthGate`, `Analytics`, `PublishQueue` page, `Intel` page, `WinnerSignals`, or `PushSubscribeButton`.

---

## Ranked improvements

1. **Make both cron endpoints fail closed** when `CRON_SECRET` is missing or empty, and add a test for it. Smallest change with the largest security payoff. (P1-1)
2. **Confirm the `source_key` migration state in Supabase**: that the column exists, that the unique index is not partial, and whether old rows were backfilled. Then make one real call to the ingest endpoint. (P1-2, P1-3)
3. **Make the nudge report its own failure**: non-200 when subscriptions cannot be fetched, a distinct failing state for zero subscriptions, and a client check of the real `pushManager` subscription instead of the localStorage flag. (P1-4)
4. **Surface load and write errors in the UI** using the pattern already in `PublishQueue.tsx` and `ScheduleIdeaModal.tsx`, and clear `error` on a successful load. (P1-6, P1-7)
5. **Skip today in `planWeek` when 2:00 PM Eastern has passed.** (P1-5)
6. **Tighten the next-post brief**: per-group minimum sample, per-platform medians, and a real recency window or corrected wording. (P2-1, P2-2, P2-3)
7. **Check a schema and RLS snapshot into the repo** so policies can be reviewed and rolled back. (P2-13)
8. **Send only changed fields from the edit modal.** (P2-5)
9. **Debounce and sequence realtime refetches.** (P2-6)
10. **Remove parked code and update README and `.env.example`.** (P2-13, P2-15)
11. **Add lint to CI and handler-level tests for the API.** (P2-16)

---

## Task candidates

Each is a single source file, plus its existing test file where one exists.

| # | File | Change | Finding |
|---|---|---|---|
| 1 | `api/ingest-content-ideas.js` | Return 500 if `CRON_SECRET` is unset or empty, before comparing. | P1-1 |
| 2 | `api/send-posting-cadence-nudge.js` | Same fail-closed guard. | P1-1 |
| 3 | `api/send-posting-cadence-nudge.js` | Check `r.ok` in all three fetch helpers; return 502 when subscriptions cannot be loaded; wrap the handler in `try/catch`. | P1-4, P2-8 |
| 4 | `.github/workflows/posting-cadence-nudge.yml` | Fail the job when the message is "No subscriptions, no push sent". | P1-4 |
| 5 | `src/components/PushSubscribeButton.tsx` | Decide visibility from `pushManager.getSubscription()` instead of the localStorage flag. | P1-4 |
| 6 | `src/lib/planWeek.ts` | Drop today from `openDays` when the current Eastern time is past `DEFAULT_HOUR`; add the test case. | P1-5 |
| 7 | `src/hooks/useIdeas.tsx` | Call `setError(null)` on a successful load. | P1-6 |
| 8 | `src/pages/Ideas.tsx` | Show `error` from `useIdeas`; catch and display failures from add, move, and delete. | P1-6, P1-7 |
| 9 | `src/components/IdeaDetailModal.tsx` | Catch save failures and show a message; block an empty title. | P1-7, P2-5 |
| 10 | `src/pages/Analytics.tsx` | Catch save failures; store `null` for an emptied metric input. | P1-7, P2-7 |
| 11 | `src/lib/nextPostBrief.ts` | Require a minimum post count per pillar and per class; replace the non-null assertion with a fallback label. | P2-1, P2-3 |
| 12 | `api/ingest-content-ideas.js` | Allowlist accepted columns, trim the title before building `source_key`, reject non-object items with 400. | P1-3, P2-10 |
| 13 | `src/pages/Intel.tsx` | Derive "Added" from existing ideas' `source_intel_insight_id`; disable the button while the insert is in flight. | P2-12 |
| 14 | `src/hooks/useExperiments.ts` | Expose a load `error` so Analytics does not offer "Start Experiment" after a failed load. | P2-11 |
| 15 | `.env.example` | List the four server-side variables with placeholders. | P2-13 |
| 16 | `README.md` | Correct the pipeline stages and page list. | P2-15 |
| 17 | `.github/workflows/content-ci.yml` | Add an `npm run lint` step. | P2-16 |

**Not a code task — needs Carl:** confirm the `source_key` migration state (improvement 2), confirm `CRON_SECRET` is set in every Vercel environment, and decide whether `videoCompress.ts` and the `@ffmpeg/*` dependencies stay parked or get removed.

---

## Summary

| Priority | Count |
|---|---|
| P0 | 0 confirmed |
| P1 | 7 |
| P2 | 16 |
