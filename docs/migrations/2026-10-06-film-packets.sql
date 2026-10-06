-- Film Mode v1: one packet per content idea. Ordering is by `version` (bumped by trigger), never by client clocks.
create table public.film_packets (
  id uuid primary key default gen_random_uuid(),
  content_idea_id uuid not null unique references public.content_ideas(id) on delete cascade,
  shots jsonb not null default '[]'::jsonb
    check (jsonb_typeof(shots) = 'array' and octet_length(shots::text) <= 200000),
  state text not null default 'filming' check (state in ('filming', 'ready_to_edit')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.film_packets_bump() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger film_packets_bump before update on public.film_packets
  for each row execute function public.film_packets_bump();

alter table public.film_packets enable row level security;
revoke all on public.film_packets from anon;

create policy "owner select film_packets" on public.film_packets
  for select to authenticated using (coaching_is_owner());
create policy "owner insert film_packets" on public.film_packets
  for insert to authenticated with check (coaching_is_owner());
create policy "owner update film_packets" on public.film_packets
  for update to authenticated using (coaching_is_owner()) with check (coaching_is_owner());
create policy "owner delete film_packets" on public.film_packets
  for delete to authenticated using (coaching_is_owner());
