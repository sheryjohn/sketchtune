-- Sketchtune gallery: run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.sketches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 60),
  author text not null default 'Anonymous' check (char_length(author) between 1 and 24),
  code text not null check (char_length(code) between 10 and 20000),
  thumb text not null check (char_length(thumb) between 10 and 60000),
  genre text,
  bpm int check (bpm between 40 and 200),
  scale text,
  key int check (key between 0 and 11),
  prompt text,
  remix_of uuid references public.sketches(id) on delete set null,
  likes int not null default 0,
  plays int not null default 0
);
create index if not exists sketches_created_idx on public.sketches (created_at desc);
create index if not exists sketches_likes_idx on public.sketches (likes desc, created_at desc);
create index if not exists sketches_prompt_idx on public.sketches (prompt);

alter table public.sketches enable row level security;

-- Anyone may read and publish. Nobody may edit or delete through the API (do that in the dashboard).
drop policy if exists "public read" on public.sketches;
create policy "public read" on public.sketches for select to anon, authenticated using (true);
drop policy if exists "public insert" on public.sketches;
create policy "public insert" on public.sketches for insert to anon, authenticated
  with check (likes = 0 and plays = 0);

-- Counters move only through these functions, so visitors cannot set arbitrary numbers.
create or replace function public.like_sketch(sid uuid) returns void
language sql security definer set search_path = public as $$
  update public.sketches set likes = likes + 1 where id = sid;
$$;
create or replace function public.play_sketch(sid uuid) returns void
language sql security definer set search_path = public as $$
  update public.sketches set plays = plays + 1 where id = sid;
$$;
grant execute on function public.like_sketch(uuid) to anon, authenticated;
grant execute on function public.play_sketch(uuid) to anon, authenticated;

-- Added with the Pro feature: marks sketches published by supporters.
alter table public.sketches add column if not exists supporter boolean not null default false;
