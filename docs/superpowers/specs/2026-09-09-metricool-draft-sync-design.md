# Metricool Draft Sync — Design Spec

**Date:** 2026-09-09
**Status:** Ready to plan
**Source:** #1 of the 2026-09-09 weekly project vision scan (`Claude Outputs/project-vision-scan-2026-09-09.md`), Carl's pick.

## Problem

`PublishQueue.tsx` is fully built — "Plan This Week" batch-schedules READY ideas, "Edit schedule" sets a precise publish time, "Mark Posted" closes the loop. None of it actually reaches a social platform. Carl already has a live Metricool account with real scheduling/review-queue capability, and currently re-types the caption there by hand for every post this app already has fully written. The value here is purely eliminating that retype — not building a publishing pipeline from scratch.

## Scope decision: draft sync, not auto-publish

`content_ideas` has no video/media field anywhere in its schema, and Carl confirmed the actual video file's location varies (sometimes stays on his phone and gets posted directly from TikTok/IG's own app, sometimes lands in a linked Drive/Dropbox folder) — there is no reliable, universal media URL available at the moment an idea gets scheduled. Metricool's own `createScheduledPost` requires real media for Instagram/TikTok/YouTube/Pinterest posts, so unattended `autoPublish: true` isn't buildable without solving media storage first, which is explicitly out of scope here.

Instead: scheduling an idea in Content Manager creates a **draft** post in Metricool (`draft: true`) with the caption, platform(s), and timing already filled in. Carl finishes it from Metricool's own app — attaching whatever video source he actually used for that post — and publishes from there. This directly kills the "retype the caption" busywork, which was the actual ask, without requiring a media pipeline this spec was never asked to build.

## Architecture

### New serverless function: `api/metricool-schedule.js`

Vercel function (matching the existing `api/ingest-content-ideas.js`/`api/send-posting-cadence-nudge.js` convention — this repo already has a server-side layer, not just a static frontend). Calls Metricool's real REST API directly — **not** the MCP connector, which only exists inside a Claude session and has no bearing on what Carl's actual deployed app can call at runtime. Auth: `X-Mc-Auth` header carrying a `userToken` from Metricool account settings, plus `userId`/`blogId` as query params (per Metricool's public API docs, `help.metricool.com/en/article/abukgf`). Real gate, not assumed: API access requires Metricool's **Advanced plan or higher** — Carl needs to confirm his plan tier and pull the token before this is buildable; the plan will start with that check, not skip past it.

Credentials (`METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID`) are Vercel environment variables, never client-side — this function is the only thing that ever sees them.

**Request shape:** `{ ideaId, title, hook, platform, publishAt }` → the function builds Metricool's `info` JSON (`text` from title+hook, `providers` mapped from `platform`, `draft: true`, `autoPublish: false`) and the `date`/`publicationDate` fields from `publishAt`, using the account's real IANA timezone (fetched once via Metricool's brand-settings endpoint, not hardcoded — matches `getBrandSettings`'s own documented purpose). Returns Metricool's post `id`/`uuid` on success.

### Platform mapping

Content Manager's `platform` is `'tiktok' | 'instagram' | 'both'`; Metricool's `providers` is a list. `'both'` → `[{network:'tiktok'}, {network:'instagram'}]`; a single platform → that one provider only.

### `content_ideas` gains two columns

`metricool_post_id: string | null`, `metricool_post_uuid: string | null` (applied live via the Supabase MCP `apply_migration` tool at implementation time, matching this project's established convention for schema changes — no tracked `.sql` migration files exist in this repo today). Set on the first successful sync. A **re-schedule** (Carl edits the publish time again after the first sync) must call Metricool's update-post endpoint using the stored `id`/`uuid`, not create a second draft — this is why the columns exist, not just for record-keeping.

### Trigger point: `usePipeline.ts`'s `scheduleIdea`

Fires automatically, immediately after `scheduleIdea`'s existing `update(id, patch)` call resolves successfully — both call paths that reach `scheduleIdea` (`PlanThisWeek`'s batch loop and `ScheduleIdeaModal`'s single-idea path) get the sync for free, no wiring needed in either caller. The local `publish_at` write is the source of truth; the Metricool push is a side effect of it succeeding, not a precondition.

## Error handling

The Metricool push is fire-and-forget relative to the local schedule: if it fails (bad/expired token, Metricool rate limit, plan doesn't actually have API access, network blip), `scheduleIdea`'s promise still resolves — Carl's real schedule already landed in `content_ideas` and must never be rolled back or blocked by a sync failure to a third-party service. The failure is recorded (a new `metricool_sync_error: string | null` column, or reuse the two id columns staying `null` as the failure signal — decided at plan time) and surfaced as a small "Metricool: failed to sync — retry" affordance on the queue row, with a manual retry action calling the same serverless function again. Never a blocking error, never a silent one either.

A stale/expired Metricool token returns a specific auth error from their API — the retry affordance's error text should say "check your Metricool token" rather than a generic failure message, since that's the single most likely real-world cause.

## Testing

- `api/metricool-schedule.js`: unit tests (matching this repo's existing `*.test.js` convention, e.g. `posting-cadence-logic.test.js`) covering the platform-mapping logic (`'both'` → 2 providers, single platform → 1), the create-vs-update branch (no stored `metricool_post_id` → create; a stored one → update instead of a second draft), and that a Metricool API error surfaces as a structured failure rather than throwing past the caller.
- `scheduleIdea`: a test confirming the local `update()` result doesn't depend on the Metricool call's outcome (mock the fetch to fail, assert `scheduleIdea` still resolves and `content_ideas.publish_at` still gets set).
- Live verification (this project's UI-change convention): schedule one real idea via "Edit schedule", confirm a real draft appears in Metricool's own planner (via `getScheduledPosts` or the Metricool web app) with the correct caption/platform/time; re-schedule the same idea and confirm it updates the existing draft rather than creating a second one; verify the failure-and-retry path with a deliberately wrong token.

## Acceptance criteria

1. Scheduling a READY idea (either "Plan This Week" or "Edit schedule") creates a real Metricool draft with the correct caption, platform(s), and time — verified against Metricool directly, not just a 200 response.
2. Re-scheduling the same idea updates the existing Metricool draft, never creates a duplicate.
3. A Metricool sync failure never blocks or reverts the local schedule, and is visibly surfaced with a working retry.
4. No media/video handling anywhere in this feature — that's explicitly Carl's own step in Metricool's app.

## Out of scope (YAGNI, not this spec)

- **`autoPublish: true`** — needs a reliable media URL this system doesn't have; revisit only if Carl standardizes on one video-storage location for every post.
- **`createScheduledPostForReview`'s approval flow** — built for teams with reviewers; Carl works solo on this app.
- **Any media-upload UI in Content Manager** — Carl attaches media in Metricool's own app, by design.
- **Syncing "Mark Posted" back from Metricool** — the existing manual "Mark Posted" flow (shipped this week, `content@6bf85e0`) stays exactly as-is; this spec only covers the scheduling-time push, not a posted-status webhook back from Metricool.
