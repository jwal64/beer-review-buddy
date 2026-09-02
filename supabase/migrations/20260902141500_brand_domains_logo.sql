-- The logo stops being something we ask a stranger for on every render.
--
-- Until now a beer's logo was fetched at page load from Brandfetch, then
-- Google, then Icon Horse. Brandfetch now answers 403 to the public client ID
-- both surfaces embedded — every domain, every URL shape — so the first tier
-- resolved nothing for anybody, and 97 of 101 beers quietly fell through to
-- Google's *default* 16px favicon and rendered a hundred identical grey
-- globes. Nothing in the repo had changed. Nothing in the repo could have
-- prevented it.
--
-- So each brand's logo is fetched once, committed under the static site's
-- logos/, and named here. `brand_domains` is the right home for it: it is
-- already the one row per beer *name*, which is what a logo belongs to — a
-- beer drunk six times has six rows in `beers` and one here, and a beer still
-- only on the shortlist has none there and one here.
--
-- `beers.logo` keeps its meaning and its precedence: it is the per-review
-- escape hatch, for giving one beer artwork the brand's own file does not
-- have. The domains stay too, as the fallback for a beer with no file yet.
alter table public.brand_domains add column if not exists logo text;

comment on column public.brand_domains.logo is
  'Path to the committed logo file for this brand, relative to the static site '
  '(e.g. "logos/duvel.webp"). Null means no file yet, and the domains are used.';

-- A path into logos/, never a URL. The whole point of the column is that the
-- picture is ours and cannot be withdrawn; a stored "https://…/logo.png" is
-- the same hotlink the column replaces, wearing the column's name.
alter table public.brand_domains drop constraint if exists brand_domains_logo_local;
alter table public.brand_domains add constraint brand_domains_logo_local
  check (logo is null or logo ~ '^logos/[A-Za-z0-9._-]+\.[A-Za-z0-9]+$');
