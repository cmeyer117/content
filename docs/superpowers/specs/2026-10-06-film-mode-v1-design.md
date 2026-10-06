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
| version | integer not null default 1 | bumped by a `before update` trigger; the only thing used to order edits (never a client clock) |
| created_at, updated_at | timestamptz | both server-set (`default now()`, trigger on update); informational only |

Validation: a check constraint requires `shots` to be a JSON array; the client normalizes every shot (non-empty unique id, label capped at 200 chars, take ref/note capped at 1000 chars) and rejects or repairs malformed data from the server or a draft.

RLS: owner-only with explicit `select`, `insert`, `update` and `delete` policies, each with the same owner predicate `content_ideas` uses (read its live policies first and copy the exact predicate; never an anon grant, never `auth.uid() is not null` alone). Tested as owner, as a different authenticated user, and as anon (the last two must fail). `ContentIdea` and its `status` are never written by Film Mode. Film Mode cannot publish, schedule or change pipeline state.

A `take.ref` is free text or a pasted link (camera-roll note, Drive link, filename). The app stores it; it never fetches or uploads it.

## Seeding

First open of a READY idea creates the packet with three shots from the idea: **Hook** (`hook_first_2s`, falling back to `hook`), **Demo** (`body` first line, falling back to "Main demonstration"), **Payoff** (`viewer_payoff`, falling back to "Result / payoff"). Seeded labels are plain strings; after seeding, the packet owns them. Carl can rename, reorder, remove or add shots. Later edits to the idea do not rewrite an existing packet. Creation is insert-once (`insert ... on conflict (content_idea_id) do nothing`, then read the row back); it never replaces an existing packet, so two tabs seeding at once cannot overwrite each other's work.

## UI (phone first)

- New **Film** tab (`/film`, `pages/Film.tsx`; add the route in `App.tsx` and a nav item in `Layout.tsx`). Today's `Layout.tsx` is a fixed `w-48` sidebar with `p-6` content and no phone treatment, so v1 includes the minimum to make Film reachable and usable on a phone: below the `md` breakpoint the sidebar becomes a compact top/bottom nav, and the Film card has no horizontal scroll at 375px. No other page is redesigned. Lists READY ideas with progress (`filmed/total shots`, e.g. `2/3 filmed`, using the current shot count; a packet with no shots reads `no shots`; plus `ready to edit` or `not started`). Ideas that already left READY keep their packet but are not listed.
- Tapping one opens `FilmCard`, a one-card stepper:
  - Pinned header: viewer promise (`viewer_payoff`) and spoken hook (`hook_first_2s` / `hook`).
  - Current shot: label (editable), `filmed` toggle, take rows (ref + note), add/remove take, move shot up/down, remove shot, add shot.
  - A shot marked filmed with no take ref shows **missing take**; the stepper's last step lists every missing take.
  - Last step: **Mark ready to edit** (sets `state`; allowed with missing takes after a visible warning) and **Copy packet**. Un-marking back to `filming` is allowed.
- Copy packet text: title, hook, promise, shots in order with take refs and notes, missing-take lines, then the existing caption (`packetText(idea,'caption')`). Copy uses the same clipboard pattern as the publish packet, including its failure message.
- Desktop: the same card in a centered column. No separate desktop design in v1.

## Save, retry and resume

Ordering is by server `version`, never by timestamps.

1. Every change is written to a per-idea `localStorage` draft first (`film-draft:<idea id>`: `{baseVersion, shots, state}`, where `baseVersion` is the server version the edit started from).
2. Save is a conditional update: `update film_packets set shots=…, state=… where content_idea_id=… and version = baseVersion`, returning the new row. One row back = success: the draft is cleared only now, and `baseVersion` becomes the returned version. Zero rows = conflict.
3. Conflict (another device or tab saved first): reload the server row and show "This packet changed elsewhere": **Keep mine** (re-save my draft on top of the new version) or **Use theirs** (discard the draft). Never a silent overwrite either way.
4. Network or server error: inline error with **Retry**; the draft stays and the card shows **Unsynced**. If the response is lost after a successful save, the retry hits the conflict path only when someone else also saved; otherwise a retry whose `baseVersion` is stale because our own save landed is detected by the returned row already equalling the draft, and treated as success.
5. On open: no draft means use the server row. A draft with `baseVersion` equal to the server version means resume the draft (unsynced edits). A draft with a different `baseVersion` is a conflict (step 3). A draft with no server row is saved as a new packet only through the insert-once path.
6. Every localStorage read and write is wrapped in try/catch and a corrupt or oversized draft is discarded; storage failure never blocks the screen. While the tab is open the card refetches on `visibilitychange` so a packet edited elsewhere is noticed on return.

Deliberately single-flight: one save in flight per packet; edits made meanwhile coalesce into the next save.

## Units

- `lib/filmPacket.ts` — pure, no I/O: `seedShots(idea)`, `moveShot`, `removeShot`, `addShot`, `setFilmed`, `missingTakes(shots)`, `filmProgress(packet)`, `packetCopyText(idea, packet)`, `resolveOpen(server, draft)` (returns resume / use-server / conflict), `normalizeShots`. Depends only on types and `packetText`.
- `lib/filmStore.ts` — Supabase read, insert-once create, conditional update by `version`, plus draft read/write; the only I/O. (A new boundary: existing code calls `supabase.from` inside hooks such as `useIdeas`; it does not subscribe to `film_packets`, so this feature refetches on open and on `visibilitychange` instead.)
- `pages/Film.tsx` (list), `components/FilmCard.tsx` (stepper). Each depends on the two lib files; no component touches Supabase directly.

## Testing

Test-first for `filmPacket.ts` (seed with and without fallbacks, reorder/remove/add, missing-take detection, progress label for 0/added/removed shots, packet text, `resolveOpen` for all five open cases, malformed draft normalization). `filmStore` tested with a stubbed client (insert-once never replaces, conditional update returns zero rows on a stale version, lost-response retry treated as success, failure keeps the draft, draft cleared only after a confirmed save, two sequential seeds leave one packet). Component tests for the stepper: resume a half-filmed packet, remove/reorder a shot, a missing take is flagged, ready-to-edit leaves the idea's status untouched, retry after a failed save. Before any push: `npm run typecheck`, `npm test`, `npm run build`. Migration and RLS checked with the `supabase-rls-audit` skill. Acceptance on the real phone at the gym is Carl's check, not claimed from tests.

## Acceptance examples (from the outlook)

1. Resume a partially filmed packet after closing the tab.
2. Remove or reorder a shot.
3. Identify a missing take.
4. Produce a packet for an existing draft without changing the idea's status.
5. Use the screen on the actual phone at the gym.
6. (Added after the Codex review) Interrupted save: edit a take ref, force the save to fail, reload; the draft is still shown marked **Unsynced**; restore the network, Retry; the server row has the edit exactly once. Repeat with a newer server edit made elsewhere: the user gets the Keep mine / Use theirs prompt and nothing is silently overwritten.

## Review log

2026-10-06 luna Codex cold take (`Codex Outputs/2026-10-06-film-mode-spec-luna-review.md`). Accepted: server version plus conditional update instead of client clocks, insert-once seeding, draft lifecycle, explicit RLS policies and tests, input validation, progress denominator, phone nav gap, interrupted-save test. Declined: cutting reorder, add/remove shots and per-take notes (Carl approved them; reorder/remove is an outlook acceptance example); conflict handling stays but is a small two-button prompt, not a merge.

## Open items for the plan

- Where Content's Supabase migrations live (none in the content repo): find before writing the migration; apply with explicit approval, never auto.
- Cost: zero API spend; all subscription/free-tier.

## Deferred follow-ups

Vision "film today" deep link into a packet; edit packet with cut order and rights notes (outlook C2); series workbench (C3).
