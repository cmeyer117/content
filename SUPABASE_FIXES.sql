-- Content Manager — RLS + schema fixes found during verification 2026-07-02
-- Run in Supabase dashboard SQL editor (anon key can't ALTER / manage policies).

-- 1. Intel page can't read briefs — creator_insights has an INSERT policy but no SELECT.
--    Without this the Intel page shows "No briefs yet" forever, even after Monday's run.
create policy "anon read insights" on creator_insights
  for select to anon using (true);

-- 2. Pillar rework is rejected by the DB — content_ideas has a CHECK constraint still
--    pinned to the old 6-pillar list, so 'diet'/'training' inserts fail with 23514.
--    Drop the old constraint and re-add it matching the new 4-pillar schema.
alter table content_ideas drop constraint if exists content_ideas_pillar_check;
alter table content_ideas add constraint content_ideas_pillar_check
  check (pillar in ('training', 'diet', 'mindset', 'life'));
