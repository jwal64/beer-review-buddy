-- Last night's Lovable session added a second, looser check constraint on
-- brand_domains.logo (brand_domains_logo_path, no extension required)
-- alongside the one already here (brand_domains_logo_local, which does
-- require one). Its own migration file is reverted along with the rest of
-- that session's changes, but if it already applied before the revert
-- landed, the stray constraint would survive in the database — constraints
-- aren't undone by deleting the file that added them. Drop it explicitly;
-- brand_domains_logo_local remains and keeps enforcing the real rule.
alter table public.brand_domains drop constraint if exists brand_domains_logo_path;
