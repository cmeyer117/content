# Row Exercise Bible → Content Manager Idea Bank

## Goal

Surface the research already written in Row's 9-part Exercise Bible (vault: `Carl Meyer/03 - Bodybuilding/...`) as content ideas inside the existing `content_ideas` idea bank, so Carl's fitness content pipeline draws on existing research instead of starting from scratch each time.

## What's already there (no new infra)

- `content_ideas` Supabase table already has a `training` pillar (`src/lib/constants.ts`) and matching CHECK constraint.
- `ContentIdea` type (`src/types/content.ts`) already covers everything needed: `title`, `hook`, `body`, `pillar`, `status`.
- Existing precedent for a script writing to this table via Supabase REST: `api/send-posting-cadence-nudge.js`.

## Idea unit

One idea = one myth-bust, corrected cue, or non-obvious research finding pulled from a manual — not one card per exercise (too granular, ~100+ near-duplicate cards) and not one card per manual (too coarse, not an actionable hook). Roughly 3-6 per manual, ~30-50 total across all 9.

Example: "Toe angle doesn't isolate VMO on Leg Extensions — here's what actually does" (pulled from the Quads manual's Codex-corrected cue).

## Process (two separated steps)

**1. Extraction — judgment-based, done manually per manual set.**
Read each of the 9 Exercise Bible manuals, pull out myth-busts/corrected-cues/surprising-but-cited findings, write them out as a flat JSON list:
```json
[{ "title": "...", "body": "...", "pillar": "training" }]
```

**2. Insertion — mechanical, reusable script (`scripts/ingest-row-ideas.js`).**
- Takes the JSON list (path as CLI arg, or a checked-in file under `scripts/data/`).
- Before inserting each item, queries `content_ideas` for an existing row with the same `title` — skips if found (idempotent, safe to re-run).
- Inserts new ones as `status: 'IDEA'`, `pillar: 'training'`, using the same Supabase REST pattern as `send-posting-cadence-nudge.js`.
- `--dry-run` flag prints what would be inserted/skipped without writing — doubles as the runnable check.

## Reuse path

When a future manual is added (new body part, or a revision to an existing one), repeat both steps: extract new hooks into a fresh/updated JSON list, re-run the script. Already-inserted titles are skipped automatically.

## Out of scope

- No new Supabase table or pillar.
- No automated NLP extraction from manual prose — extraction is a judgment call done by reading, not parsing.
- No UI changes to Content Manager — ideas land in the existing idea bank exactly like manually-created ones.
