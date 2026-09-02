do $$
declare
  spec text[][] := array[
    ['breweries','lang'],
    ['beers','origin_cc'], ['beers','abv'],   ['beers','method'],
    ['beers','city'],      ['beers','region'],['beers','country'], ['beers','cc']
  ];
  i int;
  t text; c text; n bigint;
begin
  for i in 1 .. array_length(spec, 1) loop
    t := spec[i][1];
    c := spec[i][2];
    execute format('select count(*) from public.%I where %I is null', t, c) into n;
    if n = 0 then
      execute format('alter table public.%I alter column %I set not null', t, c);
    end if;
  end loop;
end $$;

alter table public.beers drop constraint if exists beers_rating_quarters;
alter table public.beers add constraint beers_rating_quarters
  check (rating >= 0 and rating <= 5 and (rating * 4) = round(rating * 4));

alter table public.beers drop constraint if exists beers_method_known;
alter table public.beers add constraint beers_method_known
  check (method in ('Bottle', 'Can', 'Draft', 'Nitro'));

create or replace function public.is_bare_domain_list(domains text[])
returns boolean language sql immutable set search_path = public as $fn$
  select coalesce(array_length(domains, 1), 0) >= 1
     and not exists (
       select 1 from unnest(domains) as d
       where d is null or d !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
     );
$fn$;

alter table public.brand_domains drop constraint if exists brand_domains_bare;
alter table public.brand_domains add constraint brand_domains_bare
  check (public.is_bare_domain_list(domains));