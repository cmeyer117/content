# Content Manager — Capture-First Reshape

**Date:** 2026-08-14
**Status:** Approved by Carl (brainstorm + revised after discovering `content-autopilot`'s existing pipeline). Pending written-spec review.
**Supersedes:** an earlier version of this spec that proposed building transcription, caption generation, and a new `content_ideas` schema from scratch. That version is wrong — see "What changed the plan" below.

## Context

Carl freeballs everything on camera — no scripts, ever. He said he almost never opens Content Manager. The original read on this was "the app is missing a post-capture generation layer" (caption, hooks, hashtags, cut notes), matching Codex's same-day source audit finding.

**That layer already exists and has been running twice a day.** `content-autopilot` (`.claude/scheduled-tasks/content-autopilot/SKILL.md`) watches `G:\My Drive\Claude\Content Inbox\`, and for every video dropped there: splits it if long, transcribes/analyzes it (`analyze_clip.py`), scores it, drafts a caption + 2-3 hook alternatives in Carl's actual voice (via the `carl-content` skill — the same voice system used to audit today's content queue), classifies it technique/craft/transformation/diary, writes a `content_ideas` row, and sends a Telegram approval card. On approve, it auto-schedules to Metricool.

**The `Content Inbox` folder has never received a single file.** Confirmed via `ls` — empty except a `.gitkeep`. This entire pipeline has been running against nothing. The real gap was never generation — it's that "navigate to a Google Drive folder on desktop and drop a file in" doesn't survive contact with someone who freeballs and doesn't manage files that way. Carl confirmed he'd forgotten this pipeline did this much.

## What changed the plan

The original spec (data model additions to `content_ideas`, in-browser transcription research, a Vision `/stt` cost investigation) was solving an already-solved problem. Scrapped. The actual smallest-version build is much smaller: **give `content-autopilot` a second, frictionless door.**

## What this build actually is

1. **A new private Supabase Storage bucket, `capture-inbox`.** Same pattern as today's `progress-photos` fix in Row — private from creation, not public-then-locked-down. RLS: `authenticated` + `coaching_is_owner()` for insert/select (matches every other owner-only bucket in this project). No new database table or `content_ideas` columns — this bucket *is* the queue; a file's presence in it means "uploaded, not yet processed."

2. **One new page, `/capture`, replacing Dashboard as the landing route.** `/` redirects to `/capture` instead of `/dashboard`; Dashboard moves into the nav as a regular tab (same habit-formation reasoning as before — an analytics view in front of a habit Carl doesn't have yet works against building it; a one-tap upload in front of it doesn't). The page is one upload control and, below it, a list of what's currently sitting in `capture-inbox` (i.e., uploaded, waiting for the next sweep). Once `content-autopilot` picks a file up and deletes it from the bucket (see below), it drops off this list and shows up as a normal card wherever Ideas/Pipeline already renders `content_ideas` rows — no new UI needed there, that part already works.

3. **One targeted addition to `content-autopilot`'s existing Step 1**, alongside its current Drive-folder scan: also list objects in the `capture-inbox` bucket, download each new one to the same local working-directory pattern (`C:\Users\gregm\content-autopilot-work\<filename>`) it already uses for Drive-sourced files, then feed it into the *exact same* Step 2 pipeline, unmodified. On successful processing, delete the object from `capture-inbox` (mirrors how Drive-sourced files get moved to `Processed\`) instead of moving a file — a `.attempts`-sidecar-style retry count keyed by object name handles the same 3-strikes-then-flag behavior Step 1 already has, if a bucket-sourced file fails repeatedly.

   **Needs verification at plan time, not assumed here:** the bucket is owner-RLS-gated (matching today's security fixes elsewhere in this project), so downloading an object's actual bytes needs the project's service-role key as a Bearer token against the Storage REST API (`GET /storage/v1/object/capture-inbox/<path>`) — the anon/publishable key won't authenticate against a private bucket. The plan needs to establish where `content-autopilot`'s scheduled-task session gets that key from (e.g., pulled once via `vercel env pull` against Content Manager's project, same mechanism used earlier today to wire up `coaching-app`'s Stripe keys) — not left as an assumption that it's "just available."

That's the entire build. Everything downstream of "a video file exists somewhere `content-autopilot` looks" — splitting, transcription, caption/hook drafting in Carl's voice, content-class scoring, Telegram review, Metricool scheduling — is unchanged, because none of it needs to change.

## Upload flow (the actual UX)

1. Carl opens the app → lands on `/capture`. One upload control (file picker; on a phone this surfaces the camera roll and, on most mobile browsers, a direct "record video" option too — no extra work required to get that for free).
2. Selecting a file uploads it directly to `capture-inbox/<timestamp>-<original filename>` via the authenticated Supabase client, using the owner's session token (same auth pattern as every other write in this app).
3. On success, the file appears in the "waiting" list below the upload control. On failure (network, size, unsupported format), a visible error with a retry action — this app already has one P1 finding today about mutations failing silently; this build doesn't repeat it.
4. Up to ~12 hours later (the next `content-autopilot` sweep, 11am or 6pm), the file gets processed exactly as a Drive-sourced file would, and a Telegram card shows up for Carl to approve/edit/skip.

## Explicitly out of scope for this build

- Any transcription, caption generation, hook generation, hashtag generation, or cut-note generation — all already exist in `content-autopilot`.
- Any change to `content_ideas`'s schema.
- Any change to Ideas/Pipeline/Analytics/Intel pages.
- Faster-than-next-sweep processing (Carl confirmed the ~12hr cadence is fine for now — revisit only if it proves to be real friction once the front door is actually being used).
- Replacing or improving the Telegram review experience — untested with real content so far; revisit if it turns out to be the next real friction point once uploads are flowing.
- A Format Vault / viral-reference library (Codex's audit proposal, separate build).
- Rebuilding the desktop-rail layout for mobile generally — this build makes the one page that most needs to work on a phone simple enough not to need it; the rest of the app's layout is unchanged.

## Error handling

- Upload failure → visible error, retry action, nothing silently lost.
- `content-autopilot`'s bucket-check step failing to reach Supabase Storage → same treatment its existing Drive-folder scan gets: logged in the run report, retried next sweep, never silently drops a file.
- A bucket-sourced file that fails processing 3 times → same "failed 3x, needs manual look" reporting the Drive-inbox path already has, not a new failure mode to design.
