-- Run this once if you created the table before the Pro feature was added.
alter table public.sketches add column if not exists supporter boolean not null default false;
