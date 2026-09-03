alter table public.brand_domains add column if not exists logo text;
alter table public.brand_domains drop constraint if exists brand_domains_logo_path;
alter table public.brand_domains add constraint brand_domains_logo_path
  check (logo is null or logo ~ '^logos/[A-Za-z0-9._-]+$');