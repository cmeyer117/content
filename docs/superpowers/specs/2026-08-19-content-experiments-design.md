# Weekly Experiment Queue — Design Spec

**Date:** 2026-08-19
**Status:** Approved, ready for implementation plan

## Context

Item 5 of the 2026-08-18 future-features review (`Claude Outputs/2026-08-18-future-features-pass.md`): the app captures the right pre-production attributes (`content_class`, `hook`, `viewer_payoff`, `target_length_seconds`) but `Analytics` never groups outcomes by any of them — easy to keep posting while learning nothing causal. Goal: one hypothesis, a matched set of posts, a verdict, at a time.

Scoped independently of future-features item 1 (deeper retention metrics) — this uses whatever's already on `content_ideas` today (`views`, `likes`, `shares`, `saves`, `metricool_engagement_rate`).

## Data Model

Follows the flat-column, manually-applied-SQL pattern from the hook-first gate (`2026-08-17-hook-first-gate-design.md`) — no migration tooling in this repo.

```sql
create table experiments (
  id uuid primary key default gen_random_uuid(),
  hypothesis text not null,
  status text not null default 'active',   -- 'active' | 'concluded'
  verdict text,
  created_at timestamptz not null default now()
);

alter table content_ideas add column experiment_id uuid references experiments(id);
```

No `concluded_at` — `status` plus the verdict text already say what happened; nothing would read a timestamp column.

Only one experiment `active` at a time. Enforced in the UI only (disable "Start Experiment" while one is active), not a DB constraint — matches this single-user app's existing trust model (same call the hook-first gate spec made for its own fields).

## Workflow

New top section in `Analytics.tsx` (the review item frames this as an Analytics gap; one page, not a new route):

- **No active experiment:** a small form — hypothesis text input + "Start" button. Inserts a row with `status: 'active'`.
- **Active experiment:** a card showing the hypothesis, a table of every idea with `experiment_id` matching it (columns: title, `content_class`, `hook`, `target_length_seconds`, and once posted — `views`, `likes`, `shares`, `saves`, `metricool_engagement_rate`), a verdict textarea, and a "Conclude" button that sets `status: 'concluded'` and saves the verdict text. No auto-grouping, no bucketing, no computed winner — Carl reads the table and writes the verdict himself.
- **Concluded experiments:** listed below, collapsed (hypothesis + verdict visible, table hidden unless expanded).

**Tagging:** `IdeaDetailModal` gets one new control — a checkbox "Part of experiment: `<hypothesis>`" — visible only when an experiment is active. Checking it sets `experiment_id` on that idea via the existing `update()` call; unchecking clears it to `null`.

## Testing

`src/lib/chartData.ts`-style pure function (or inline in `Analytics.tsx` if trivial enough) for building the experiment table rows from `ideas` + `experiment_id` — one test file covering: empty set, mix of posted/unposted ideas in the experiment, ideas with `experiment_id` null excluded.

`IdeaDetailModal.test.tsx` (extend): checkbox appears only when an active experiment exists, toggling it calls `update` with the right `experiment_id`.

## Out of Scope

- No variant-A/B predefinition or enforced attribute control — Carl decides informally what he's testing when he writes the hypothesis and tags ideas.
- No automatic winner/significance calculation.
- No minimum sample size enforcement before "Conclude" is allowed.
- No retroactive tagging tooling — existing posted ideas stay untagged (`experiment_id: null`) unless manually edited.
- No dependency on future-features item 1 (retention metrics) — uses current metrics only.
