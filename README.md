# Content Manager

Carl Meyer's content strategy/pipeline manager for TikTok/Instagram — React 19 + TypeScript + Vite + Supabase. Deployed to Vercel at [content-nine-chi.vercel.app](https://content-nine-chi.vercel.app).

## Pages

| Page | What it is |
|---|---|
| `Dashboard` | Overview |
| `Ideas` | Content idea editor — captures/edits draft ideas (chat-driven AI drafting, zero API cost by design) |
| `Pipeline` | Content lifecycle: `draft → scheduled → published → archived` |
| `Intel` | Creator Intelligence insights — synthesized data from tracked competitor/niche creators (`creator_insights` Supabase table, fed by the separate `creator-intelligence` repo's scraper) |
| `Analytics` | Performance tracking |

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind, react-router-dom
- Persistence: Supabase
- Tests: Vitest

See `docs/` for design specs, and `G:\My Drive\Claude\HANDOFF.md` / `project-content-manager-strategy-prompt.md` (Claude memory) for current status and standing decisions (e.g. AI drafting stays chat-driven rather than an in-app API-billed button).
