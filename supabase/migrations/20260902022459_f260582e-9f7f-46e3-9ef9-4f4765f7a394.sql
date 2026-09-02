alter table public.breweries add column if not exists lang text;
alter table public.breweries add column if not exists native_name text;
alter table public.beers add column if not exists logo text;
alter table public.beers add column if not exists seq integer;
create index if not exists beers_seq_idx on public.beers (drank_on, seq);
grant usage on schema public to postgres;
alter table public.breweries owner to postgres;
alter table public.beers owner to postgres;
alter table public.locations owner to postgres;