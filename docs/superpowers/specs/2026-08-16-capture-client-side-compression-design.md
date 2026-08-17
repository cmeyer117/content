# Content Manager — Capture Client-Side Compression

**Date:** 2026-08-16
**Status:** Approved by Carl (brainstorm). Pending written-spec review.

## Context

The `/capture` page (shipped 2026-08-14) uploads video directly to the private `raw-captures` Supabase Storage bucket. First real on-device test failed: a 22-second phone clip hit "exceeded maximum size."

Root-caused live: `raw-captures` had no per-bucket `file_size_limit` override, so it inherited Supabase's project-wide storage cap. Raised the bucket override to 500MB and the upload still failed — confirming the binding constraint is the **project-wide global cap**, which is a dashboard-only setting (not SQL-editable) and, on the current plan tier, not raisable without a paid Supabase upgrade. Carl declined the upgrade. This is a real ~50MB hard ceiling, not a bug.

Modern phone video (4K60/ProRes-class settings) blows past 50MB in well under a minute of footage, so the fix has to happen before the file leaves the browser.

## What this build is

Client-side video re-encoding in the `/capture` page, using `ffmpeg.wasm`, that always runs before upload and targets a bitrate computed from the clip's own duration — using close to the full ~50MB budget on short clips instead of leaving quality on the table, while still reliably fitting longer clips under the cap.

1. **New dependency: `@ffmpeg/ffmpeg` + `@ffmpeg/core` (single-threaded build).** The single-threaded core avoids needing `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` response headers (the multi-threaded build requires them for `SharedArrayBuffer`); Vercel's static hosting doesn't set these today and adding them is out of scope. Slower than multi-threaded, acceptable given typical clip lengths and that a spinner during compression is expected UX (Carl confirmed).

2. **New module, `src/lib/videoCompress.ts`:**
   - `getVideoDuration(file): Promise<number>` — loads the file into a throwaway `<video>` element, reads `duration` from `loadedmetadata`. Pure browser API, no ffmpeg needed for this step.
   - `computeTargetBitrate(durationSeconds): number` — `min(8_000_000, (48 * 1024 * 1024 * 8) / durationSeconds)`. 48MB (not 50MB) as the target to leave a safety margin for container/audio overhead. 8Mbps ceiling because 1080p content sees no visible quality gain past that for this use case, and it avoids wasting budget on very short clips.
   - `compressVideo(file): Promise<File>` — lazily loads the ffmpeg core (only on first real use, not on page load — keeps the ~25MB wasm payload off the initial page load), scales video to max 1080p (`scale='min(1920,iw)':'-2'`, only downscales, never upscales), encodes H.264 at the computed target bitrate + AAC audio at 128kbps, returns a new `File`.

3. **`Capture.tsx` changes:** `doUpload` gains a `Compressing...` phase before the existing `Uploading...` phase — a new `stage: 'compressing' | 'uploading' | 'idle'` state replaces the current boolean `uploading`, button label switches accordingly. On compression failure, reuse the existing error banner + Retry button (Retry re-runs from the original `File` already held in state, so it retries compression, not just the upload).

## Explicitly out of scope

- Adaptive retry/resize-and-recheck if the computed bitrate still overshoots the cap for some edge case (e.g. extremely long clips) — the duration-aware formula already degrades gracefully toward very low bitrates for long clips rather than failing outright; if a real clip still overshoots in practice, revisit then rather than pre-building a retry loop for a case that may never happen.
- Server-side compression fallback.
- A quality/resolution toggle in the UI — one fixed target, no user-facing settings.
- Cross-origin-isolation headers / multi-threaded ffmpeg build (would speed up compression but adds Vercel config risk for a page that isn't latency-critical).
- Preserving original-quality footage for final-edit use — captures feed `content-autopilot`'s AI review pipeline (transcription/captions/hooks), not the final published asset; this was an explicit trade-off Carl agreed to.

## Testing

`getVideoDuration` and `compressVideo` are browser-only (real `<video>` element, real WASM transcoding) and not meaningfully unit-testable in Vitest/jsdom. `computeTargetBitrate` is pure arithmetic and gets real unit tests (short clip → ceiling-capped result, long clip → duration-scaled result, boundary at exactly 48MB/8Mbps). Real compression behavior gets verified manually in-browser with an actual phone clip, same pattern as the original `/capture` page's own testing split (pure logic tested, browser-native upload verified live).

## Open question for the plan

Confirm actual `@ffmpeg/core` single-threaded bundle size and cold-load time before committing to "lazy-load only on first use" as sufficient UX — if cold-load alone takes 10-15+ seconds on a phone connection, the plan should decide whether to show a distinct "Loading compressor..." sub-state before "Compressing..." rather than one combined spinner.
