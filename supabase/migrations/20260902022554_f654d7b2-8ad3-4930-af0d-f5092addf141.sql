create table if not exists public.countries (
  cc text primary key,
  flag text,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_domains (
  beer_name text primary key,
  domains text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists public.want_to_try (
  beer text primary key,
  style text not null,
  origin text,
  abv numeric(4,1),
  region text,
  untappd numeric(3,2),
  method text,
  aka text[],
  seq integer,
  created_at timestamptz not null default now()
);

create table if not exists public.untappd_averages (
  beer_name text primary key,
  avg numeric(3,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['countries','brand_domains','want_to_try','untappd_averages','app_meta']
  loop
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s are public" on public.%I', t, t);
    execute format('create policy "%s are public" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s writable by signed in" on public.%I', t, t);
    execute format('create policy "%s writable by signed in" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;