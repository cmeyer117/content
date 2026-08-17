# Hook-First Production Gate — Design Spec

**Date:** 2026-08-17
**Status:** Approved, ready for implementation plan

## Context

An independent-first Codex consult on Content Manager (see `Claude Outputs/2026-08-17-full-4-system-improvement-pass.md`) ranked hook-first ranking as a hard pre-production gate as the #1 priority, given the standing rule that audience/content growth is the top business priority. Real data backs the framing: IG hook-survival on technique/craft/transformation content runs 57-67% vs. 22-40% for diary-style posts. The gate's job is to force that data into every idea before it enters production, not just report on it after the fact.

## Data Model

6 new columns on `content_ideas` (flat columns, matching the table's existing style — `idea_score`, `execution_score`, `predicted_score`, etc. are all flat, not JSONB):

```sql
alter table content_ideas
  add column content_class text,              -- 'technique' | 'craft' | 'transformation' | 'diary'
  add column hook_first_2s text,               -- the opening 1-2 seconds
  add column viewer_payoff text,                -- what the viewer gets for watching
  add column target_length_seconds integer,
  add column length_justification text,        -- required only if target_length_seconds > 30
  add column diary_justification text;         -- required only if content_class = 'diary'
```

All 6 are nullable at the DB level — enforcement happens at the application gate (see below), not via NOT NULL constraints, since older/in-progress rows shouldn't suddenly become invalid.

## Gate Logic

A pure function in `src/lib/hookGate.ts`:

```typescript
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

Returns the specific missing fields, not just a boolean, so the UI can show exactly what's blocking the move.

## UI

- **`IdeaCard`'s "Move → DRAFT" button** is disabled (not hidden) when `isReadyForDraft(idea).ready` is false, with `title` set to the missing-fields list for a hover tooltip. This only applies when `nextStage === 'DRAFT'` — the gate doesn't touch any other pipeline transition (DRAFT→READY, READY→SCHEDULED, etc.).
- **`IdeaDetailModal`** gets a new "Hook-First Brief" section, shown only while `idea.status === 'IDEA'`. Contains: a `content_class` select, `hook_first_2s` and `viewer_payoff` text inputs, `target_length_seconds` number input. `length_justification` renders conditionally once `target_length_seconds > 30`; `diary_justification` renders conditionally once `content_class === 'diary'` — same conditional-field pattern already used elsewhere in the modal.

## Testing

`src/lib/hookGate.test.ts` (new file, matches `constants.test.ts`'s style):
- all 4 base fields present, length ≤30, non-diary → ready: true
- each of the 4 base fields missing individually → ready: false, missing includes that field
- diary class without `diary_justification` → ready: false
- diary class with `diary_justification` → ready: true (given other fields present)
- `target_length_seconds` = 25 → ready: true with no justification needed
- `target_length_seconds` = 45 without `length_justification` → ready: false
- `target_length_seconds` = 45 with `length_justification` → ready: true

`IdeaCard.test.tsx` (extend existing file): one new test confirming the Move→DRAFT button is `disabled` when the gate fails and enabled when it passes.

## Out of Scope

- No changes to any pipeline stage past DRAFT.
- No retroactive backfill of the 6 new fields on existing rows — they stay null until each idea is manually visited.
- No enforcement mechanism beyond the UI button disable (a direct Supabase write could still bypass it) — matches the rest of this single-user app's trust model, not worth a DB-level CHECK constraint for one operator.
