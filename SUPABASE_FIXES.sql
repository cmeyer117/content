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

-- 3. Idea + execution scoring (2026-07-21) — persist content-virality (idea stage)
--    and content-video-pick (execution stage) scores Carl generates in chat, instead
--    of losing them to scrollback. Nullable, 1-10 range enforced at the DB level so
--    a bad value can't land even from a future client, not just app-side validation.
alter table content_ideas add column if not exists idea_score int;
alter table content_ideas add column if not exists idea_score_notes text;
alter table content_ideas add column if not exists execution_score int;
alter table content_ideas add column if not exists execution_score_notes text;

alter table content_ideas add constraint content_ideas_idea_score_check
  check (idea_score is null or idea_score between 1 and 10);
alter table content_ideas add constraint content_ideas_execution_score_check
  check (execution_score is null or execution_score between 1 and 10);
