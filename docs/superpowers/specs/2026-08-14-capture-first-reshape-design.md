# Content Manager — Capture-First Reshape

**Date:** 2026-08-14
**Status:** Approved by Carl (brainstorm), pending written-spec review.

## Context

Carl freeballs everything on camera — no scripts, ever. The app's current model (type a script idea, move it through pipeline stages) doesn't match how he actually makes content, and he said outright he almost never opens it. Today's Codex source audit of Content Manager independently converged on the same diagnosis: the missing layer isn't more AI-generated ideas, it's a path from raw take → editor-ready packet. Carl's own IG re-audit data backs the "editor packet" half specifically — his craft/technique-class posts hit 57-67% 3-second hook survival vs. 22-40% for diary-class posts, so hook/cut quality is the actual lever, not more written ideas.

This is Phase 1 of the reshape: the smallest version that turns "I filmed a take" into "I have a caption, hook options, hashtags, and cut notes in my voice," without a full rebuild. Existing pipeline/analytics/Intel machinery stays as-is and gets reused, not replaced.

## What changes

1. **Capture replaces Dashboard as the landing screen.** `/` now redirects to `/capture` instead of `/dashboard`. Dashboard moves into the nav as a regular tab — still there for the periodic pillar-balance/streak check, just no longer the first thing Carl sees. This is a deliberate habit-formation choice: an analytics view in front of a habit he doesn't have yet (opening the app) discourages the exact behavior this build exists to create. A one-tap capture action in front of it does the opposite.

2. **A capture is a `content_idea` from the moment it's uploaded.** No parallel table, no separate page family. Existing pipeline stages, analytics, and Intel already understand `content_idea` rows — a captured-and-generated take just shows up there pre-filled instead of blank.

3. **Generation is a Claude Code session action, not a live API call.** Content Manager has zero existing paid-API usage anywhere in its source — adding one for this would be new standing spend, which needs Carl's explicit sign-off per his zero-live-API-call policy (the same policy that got Vessel's weekly-review endpoint disabled). Instead: a transcribed-but-not-yet-generated capture is a queued item a Claude Code session picks up (manually, or folded into the existing `content-autopilot` scheduled sweep — see Open Question below) and writes the outputs back to Supabase directly, the same way this session has been doing all day. Zero marginal cost, no new infra to build for it.

## Data model

Extend `content_ideas` (migration, additive only — no existing column touched):

| Column | Type | Purpose |
|---|---|---|
| `capture_status` | `text`, nullable, check in `('uploaded','transcribed','generated')` | `null` = a regular typed idea (today's existing flow, untouched). Set only on capture-originated rows. |
| `video_path` | `text`, nullable | Storage object path. Cleared once the video is deleted (see cleanup below) — its presence *is* "video still exists," no separate boolean needed. |
| `transcript` | `text`, nullable | Whisper output, editable by Carl before generation. |
| `overlay_options` | `text[]`, nullable | 3 candidate 0-3s on-screen hook lines, Carl picks one when editing. |
| `cut_notes` | `text`, nullable | Trim/pacing/punch-in guidance, generated from the transcript (see below). |

`hook`, `body` (caption + hashtags inline, matching the existing convention — every current READY idea already embeds hashtags in the body text, so generation follows that pattern rather than adding a separate hashtags column) are the existing fields, reused as-is for generated output.

**Storage:** new private bucket `captures` (mirrors today's `progress-photos` fix in Row — private from the start, not public-then-locked-down). RLS: `authenticated` + `coaching_is_owner()` for insert/select, same pattern as every other owner-only bucket in this Supabase project. Path convention: `<content_idea_id>/<timestamp>.<ext>`.

**Cleanup:** a scheduled task (same shape as existing scheduled tasks, e.g. folded into or alongside `content-autopilot`) deletes the storage object and clears `video_path` for any row where the video is older than 14 days, regardless of `capture_status` — the transcript and any generated output already live in the DB by then, so the video itself is disposable once its text has been extracted. 14 days is a starting number, easy to change later; not worth a config UI for one constant.

## Capture flow (the actual UX)

1. Carl opens the app → lands on `/capture`. One prominent upload control, nothing else competing for attention. No pillar/platform picker up front — that's for later, when he (or a session) reviews the generated result; forcing a choice before he's even said anything would reintroduce the friction this build exists to remove.
2. Upload creates a `content_idea` row (`capture_status: 'uploaded'`, minimal placeholder title like the upload timestamp) and the video lands in `captures/`.
3. The video's audio is sent to Vision's existing `/stt` proxy — the same free STT path Row and Vessel already use, not a new transcription service. Returns the transcript; `capture_status` → `'transcribed'`. **Unverified at spec time:** Row/Vessel call this as first-party apps under their own session; Content Manager calling in as a fourth app needs its actual auth requirements checked during planning — if `/stt` turns out to require something Content Manager can't cleanly obtain, the fallback is a local Whisper pass (already proven zero-cost elsewhere), just not the first choice.
4. Carl sees the transcript immediately, editable inline (mishears happen; per the brainstorm decision, auto-transcribe-then-edit, not blind-trust). Saves.
5. That's the entire on-the-spot flow. Generation happens later, off his phone, via a Claude Code session — see above.
6. Once generated (`capture_status: 'generated'`), the row is a normal idea: title, hook, body/caption+hashtags, overlay_options, cut_notes, pillar, platform — all editable in the existing `IdeaDetailModal`, which needs three new fields added to it (overlay options list, cut notes textarea) but no structural change.
7. The Capture page itself also shows a small "waiting on you" list below the upload button: captures at `'transcribed'` status with no generation yet, so Carl can see what's queued without hunting through Ideas.

## Error handling

This build must not repeat the P1 the 2026-08-14 audit already flagged elsewhere in this app (mutations failing silently with no user-visible feedback). Every step gets an explicit state:

- Upload failure (network, file too large, unsupported format) → visible error, retry action, no orphaned `content_idea` row left in `'uploaded'` limbo with a dead `video_path`.
- Transcription failure (Vision `/stt` unreachable or errors) → row stays at `'uploaded'`, visible "transcription failed, retry" state — never silently advances to `'transcribed'` with an empty transcript.
- Cleanup job failure (storage delete fails) → logged, retried next run; never clears `video_path` unless the delete actually succeeded, so a failed cleanup doesn't strand a dangling reference.

## Explicitly out of scope for this build

- Any change to Ideas/Pipeline/Analytics/Intel beyond the small `IdeaDetailModal` field additions above.
- Rebuilding the desktop-rail layout for mobile (a real gap the audit also flagged, but a separate, bigger project — this build makes the one page that most needs to work on a phone actually simple enough to not need it).
- A Format Vault / viral-reference library (Codex's audit proposed this too — good idea, separate build, not blocking this one).
- Video analysis of any kind (no computer vision, no auto-cut). `cut_notes` is generated text guidance from the transcript, not an automated edit.
- A settings UI for the 14-day cleanup window — a constant in code is enough for a single-user app.

## Open question for Carl (before the implementation plan)

Should generation be folded into the existing `content-autopilot` scheduled task's sweep (so a transcribed capture gets its caption/hooks/hashtags/cut-notes written automatically without Carl asking), or should it stay a manual "hey, process my captures" trigger? Automatic is more in the spirit of "help me use this more often" but changes `content-autopilot`'s scope — flagging rather than assuming.
