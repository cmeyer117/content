# Film Mode v1 (Content Manager) — design

Date: 2026-10-06. Source: Codex's `2026-10-06-future-product-outlook.md` (C1, "first build to spec"). Decisions made with Carl: data in a new `film_packets` table; entry is a new **Film** tab listing READY ideas.

## Problem

Carl picks a ready idea and goes to film it (gym, car, home). Today the idea row has the promise and hook but nothing that tracks which shots exist, which takes belong to them, or whether the idea is actually ready to edit. Ideas reach READY and stall there.

## Scope

One phone workflow: open a READY idea, work through three editable shots, attach take references and notes, mark it ready to edit, copy an edit packet, resume later.

**Out of scope:** auto-publishing or scheduling, AI video generation, media hosting or uploads, cross-post APIs, analytics changes, offer/billing, Vessel import, Vision deep link (follow-up), any new paid API call, multi-user.

## Data

New table `film_packets`:

| column | type | note |
|---|---|---|
| id | uuid pk | |
| content_idea_id | uuid unique, fk content_ideas(id) on delete cascade | one packet per idea |
| shots | jsonb | `[{id, label, filmed:boolean, takes:[{ref, note}]}]`, ordered |
| state | text check in ('filming','ready_to_edit') | default 'filming' |
| created_at, updated_at | timestamptz | `updated_at` set by the client on every save and used for draft merge |

RLS: owner-only, same policy shape as `content_ideas` (confirm by reading its live policies before writing the migration; never an anon grant). `ContentIdea` and its `status` are never written by Film Mode. Film Mode cannot publish, schedule or change pipeline state.

A `take.ref` is free text or a pasted link (camera-roll note, Drive link, filename). The app stores it; it never fetches or uploads it.

## Seeding

First open of a READY idea creates the packet with three shots from the idea: **Hook** (`hook_first_2s`, falling back to `hook`), **Demo** (`body` first line, falling back to "Main demonstration"), **Payoff** (`viewer_payoff`, falling back to "Result / payoff"). Seeded labels are plain strings; after seeding, the packet owns them. Carl can rename, reorder, remove or add shots. Later edits to the idea do not rewrite an existing packet.

## UI (phone first)

- New **Film** tab (`/film`, `pages/Film.tsx`). Lists READY ideas with progress (`2/3 filmed`, `ready to edit`, or `not started`). Ideas that already left READY keep their packet but are not listed.
- Tapping one opens `FilmCard`, a one-card stepper:
  - Pinned header: viewer promise (`viewer_payoff`) and spoken hook (`hook_first_2s` / `hook`).
  - Current shot: label (editable), `filmed` toggle, take rows (ref + note), add/remove take, move shot up/down, remove shot, add shot.
  - A shot marked filmed with no take ref shows **missing take**; the stepper's last step lists every missing take.
  - Last step: **Mark ready to edit** (sets `state`; allowed with missing takes after a visible warning) and **Copy packet**. Un-marking back to `filming` is allowed.
- Copy packet text: title, hook, promise, shots in order with take refs and notes, missing-take lines, then the existing caption (`packetText(idea,'caption')`). Copy uses the same clipboard pattern as the publish packet, including its failure message.
- Desktop: the same card in a centered column. No separate desktop design in v1.

## Save, retry and resume

Every change is written to a per-idea `localStorage` draft first (`film-draft:<idea id>`, includes `updated_at`), then saved to Supabase. Save failure shows an inline error with **Retry**; the draft stays. On open: if a local draft exists and its `updated_at` is newer than the server row (or the row is missing), the draft wins and a one-line notice says so; otherwise the server row wins and the stale draft is discarded. A localStorage failure never blocks the screen (wrap every read/write in try/catch). The packet creation call is an upsert on `content_idea_id`, so two taps cannot create two packets.

## Units

- `lib/filmPacket.ts` — pure, no I/O: `seedShots(idea)`, `moveShot`, `removeShot`, `addShot`, `setFilmed`, `missingTakes(shots)`, `filmProgress(packet)`, `packetCopyText(idea, packet)`, `mergeDraft(server, draft)`. Depends only on types and `packetText`.
- `lib/filmStore.ts` — Supabase read/upsert for `film_packets` plus draft read/write; the only I/O.
- `pages/Film.tsx` (list), `components/FilmCard.tsx` (stepper). Each depends on the two lib files; no component touches Supabase directly.

## Testing

Test-first for `filmPacket.ts` (seed with and without fallbacks, reorder/remove/add, missing-take detection, progress label, packet text, draft-vs-server merge both ways, empty-shots packet). `filmStore` tested with a stubbed client (upsert idempotence, failure path keeps the draft). Component tests for the stepper: resume a half-filmed packet, remove/reorder a shot, a missing take is flagged, ready-to-edit leaves the idea's status untouched, retry after a failed save. Before any push: `npm run typecheck`, `npm test`, `npm run build`. Migration and RLS checked with the `supabase-rls-audit` skill. Acceptance on the real phone at the gym is Carl's check, not claimed from tests.

## Acceptance examples (from the outlook)

1. Resume a partially filmed packet after closing the tab.
2. Remove or reorder a shot.
3. Identify a missing take.
4. Produce a packet for an existing draft without changing the idea's status.
5. Use the screen on the actual phone at the gym.

## Open items for the plan

- Where Content's Supabase migrations live (none in the content repo): find before writing the migration; apply with explicit approval, never auto.
- Film tab placement in `Layout.tsx` nav on mobile (count of tabs vs. width).
- Cost: zero API spend; all subscription/free-tier.

## Deferred follow-ups

Vision "film today" deep link into a packet; edit packet with cut order and rights notes (outlook C2); series workbench (C3).
