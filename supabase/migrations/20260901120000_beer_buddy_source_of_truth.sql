-- This database is the source of truth for the beer log.
--
-- Until now it held a partial copy of data.js in jwal64/JWAL-BEER-REVIEW, and
-- that file was where a beer was actually added. This migration reverses the
-- direction: it widens the schema until it can hold everything data.js holds,
-- seeds it from that file one last time, and from here the static site is
-- generated from these tables (`npm run sync` in that repo, and its Sync from
-- Supabase workflow).
--
-- So the schema is not free to drop a column the site renders. Anything not
-- stored here cannot be recovered, and `npm run check` over there is what
-- states the rules each column has to satisfy.

-- ── Existing tables, widened ──────────────────────────────────
-- A brewery's language and the beer's name in it: the passport and the
-- brewing-language chart are built from these, and nothing derives them.
alter table public.breweries add column if not exists lang text;
alter table public.breweries add column if not exists native_name text;

-- `logo` is a path to a file in the static site's logos/ directory, used for a
-- brand no logo service knows. It is not the same thing as `logo_url`, which is
-- an absolute URL this app may set; the site's own chain reads `logo`.
alter table public.beers add column if not exists logo text;

-- Reviews are shown oldest first, and a review carries a month rather than a
-- day — every row seeded below sits on the first of its month. `seq` is what
-- keeps the reviews of one month in the order they were logged, instead of
-- letting them reshuffle on every sync. A beer added in the app has no seq and
-- falls in behind on when its row was created.
alter table public.beers add column if not exists seq integer;

create index if not exists beers_seq_idx on public.beers (drank_on, seq);

-- ── The rest of the model ─────────────────────────────────────
-- A country code has to carry both a flag and a display name; one without the
-- other renders a blank or the literal code.
create table if not exists public.countries (
  cc text primary key,
  flag text,
  name text,
  created_at timestamptz not null default now()
);

-- Where a beer's logo is looked up. A beer with no row here renders a
-- placeholder forever — there is no name-based guess behind it. More than one
-- domain is allowed, tried in order, for a brand that lives at several
-- addresses. Every domain must belong to that brand: a parent company's
-- domain is a confidently wrong logo, which is worse than none.
create table if not exists public.brand_domains (
  beer_name text primary key,
  domains text[] not null,
  created_at timestamptz not null default now()
);

-- The standing shortlist of beers not yet drunk. Nothing is ever deleted from
-- it: an entry with a matching review crosses itself off and is scored against
-- the prediction made beforehand, which is the only thing that makes the
-- scorecard worth having. `aka` lists the other names the beer may be logged
-- under, for when the shelf name and the logged name differ.
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

-- The world's average for a beer, for the contrarian index. Keyed by the exact
-- beer name as reviewed.
create table if not exists public.untappd_averages (
  beer_name text primary key,
  avg numeric(3,2) not null,
  created_at timestamptz not null default now()
);

-- Small scalars that belong to the data rather than to any one row — when the
-- Untappd figures were last re-verified, and how long before that is stale.
create table if not exists public.app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ── Access ────────────────────────────────────────────────────
-- The same shape as the tables that were already here: the log is public to
-- read, and writable by anyone signed in.
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

-- ── The handover ──────────────────────────────────────────────
-- Everything below is generated from data.js as it stood at the handover, by
-- tools/export-supabase-seed.mjs in jwal64/JWAL-BEER-REVIEW.
--
-- It adds and updates; it never deletes. The earlier import already put the
-- reviews here, and they keep their rows — they gain the two columns that did
-- not exist when they were written. A beer added in the app since then is left
-- alone, which a "delete from" would not have done.

insert into public.countries (cc,flag,name) values
  ('AR'::text,'🇦🇷'::text,'Argentina'::text),
  ('AT','🇦🇹','Austria'),
  ('AU','🇦🇺','Australia'),
  ('BE','🇧🇪','Belgium'),
  ('BR','🇧🇷','Brazil'),
  ('CA','🇨🇦','Canada'),
  ('CN','🇨🇳','China'),
  ('CU','🇨🇺','Cuba'),
  ('CZ','🇨🇿','Czech Republic'),
  ('DE','🇩🇪','Germany'),
  ('DK','🇩🇰','Denmark'),
  ('DO','🇩🇴','Dominican Republic'),
  ('ES','🇪🇸','Spain'),
  ('FR','🇫🇷','France'),
  ('GB','🇬🇧','Great Britain'),
  ('GB-ENG','🏴󠁧󠁢󠁥󠁮󠁧󠁿','England'),
  ('GB-NIR','🇬🇧','Northern Ireland'),
  ('GB-SCT','🏴󠁧󠁢󠁳󠁣󠁴󠁿','Scotland'),
  ('GB-WLS','🏴󠁧󠁢󠁷󠁬󠁳󠁿','Wales'),
  ('GR','🇬🇷','Greece'),
  ('IE','🇮🇪','Ireland'),
  ('IT','🇮🇹','Italy'),
  ('JM','🇯🇲','Jamaica'),
  ('JP','🇯🇵','Japan'),
  ('LB','🇱🇧','Lebanon'),
  ('MX','🇲🇽','Mexico'),
  ('NL','🇳🇱','Netherlands'),
  ('NO','🇳🇴','Norway'),
  ('PL','🇵🇱','Poland'),
  ('PR','🇵🇷','Puerto Rico'),
  ('PT','🇵🇹','Portugal'),
  ('SE','🇸🇪','Sweden'),
  ('SG','🇸🇬','Singapore'),
  ('TH','🇹🇭','Thailand'),
  ('US','🇺🇸','USA'),
  ('ZA','🇿🇦','South Africa')
on conflict (cc) do update set flag = excluded.flag, name = excluded.name;

insert into public.locations (city,region,country,cc,lat,lng) values
  ('New York'::text,'New York'::text,'USA'::text,'US'::text,40.7128::double precision,-74.006::double precision),
  ('New Rochelle','New York','USA','US',40.9115,-73.7826),
  ('White Plains','New York','USA','US',41.034,-73.7629),
  ('Eastchester','New York','USA','US',40.9565,-73.8115),
  ('Hartsdale','New York','USA','US',41.0215,-73.7987),
  ('Montreal','Quebec','Canada','CA',45.5017,-73.5673),
  ('Amsterdam','Noord-Holland','Netherlands','NL',52.3676,4.9041),
  ('Hengelo','Overijssel','Netherlands','NL',52.266,6.793),
  ('Uncasville','Connecticut','USA','US',41.4775,-72.0892),
  ('Queens','New York','USA','US',40.7282,-73.7949),
  ('Oldenzaal','Overijssel','Netherlands','NL',52.3107,6.928),
  ('Nijmegen','Gelderland','Netherlands','NL',51.8426,5.8528),
  ('Antwerp','Antwerp','Belgium','BE',51.2194,4.4025),
  ('Boston','Massachusetts','USA','US',42.3601,-71.0589),
  ('Stamford','Connecticut','USA','US',41.0534,-73.5387),
  ('Clemson','South Carolina','USA','US',34.6834,-82.8374),
  ('Barcelona','Catalonia','Spain','ES',41.3851,2.1734),
  ('Madrid','Madrid','Spain','ES',40.4168,-3.7038),
  ('Lagos','Algarve','Portugal','PT',37.1028,-8.6736),
  ('Sciara','Sicily','Italy','IT',37.9156,13.9344),
  ('East Rutherford','New Jersey','USA','US',40.8127,-74.0846),
  ('San Juan','San Juan','Puerto Rico','PR',18.4655,-66.1057),
  ('Washington','District of Columbia','USA','US',38.9072,-77.0369),
  ('Boynton Beach','Florida','USA','US',26.5253,-80.0664),
  ('Miami','Florida','USA','US',25.7617,-80.1918),
  ('Ischia','Campania','Italy','IT',40.7333,13.95),
  ('Capri','Campania','Italy','IT',40.5532,14.2222)
on conflict (city,country) do update set region = excluded.region, cc = excluded.cc, lat = excluded.lat, lng = excluded.lng;

insert into public.breweries (name,location,country,cc,lang,native_name,lat,lng) values
  ('Weihenstephaner'::text,'Freising, Bavaria'::text,'Germany'::text,'DE'::text,'de'::text,null::text,48.3953::double precision,11.7291::double precision),
  ('Hofbräu München','Munich, Bavaria','Germany','DE','de',null,48.1351,11.582),
  ('Guinness (St. James''s Gate)','Dublin, Leinster','Ireland','IE','en',null,53.3418,-6.2868),
  ('Harp / Diageo','Dundalk, County Louth','Ireland','IE','en',null,54.0039,-6.3703),
  ('Duvel Moortgat','Puurs-Sint-Amands, Antwerp','Belgium','BE','nl',null,51.0727,4.2897),
  ('AB InBev (Stella)','Leuven, Flemish Brabant','Belgium','BE','nl',null,50.8798,4.7005),
  ('Heineken','Amsterdam, Noord-Holland','Netherlands','NL','nl',null,52.3578,4.8918),
  ('Grolsch','Enschede, Overijssel','Netherlands','NL','nl',null,52.2215,6.8937),
  ('Bavaria NV (Hertog Jan)','Arcen, Limburg','Netherlands','NL','nl',null,51.4862,6.1741),
  ('Anheuser-Busch','St. Louis, Missouri','USA','US','en',null,38.6072,-90.2124),
  ('Molson Coors','Golden, Colorado','USA','US','en',null,39.7555,-105.2211),
  ('Grupo Modelo','Mexico City, CDMX','Mexico','MX','es',null,19.4274,-99.1677),
  ('Cervecería Estrella Jalisco','Guadalajara, Jalisco','Mexico','MX','es',null,20.6597,-103.3496),
  ('Carlsberg','Copenhagen, Capital Region','Denmark','DK','da',null,55.6614,12.5361),
  ('Unibroue','Chambly, Quebec','Canada','CA','fr',null,45.4412,-73.2615),
  ('Kronenbourg','Obernai, Alsace','France','FR','fr',null,48.4637,7.4845),
  ('Sapporo Brewery','Sapporo, Hokkaido','Japan','JP','ja','サッポロビール',43.0685,141.3544),
  ('Kirin Brewery','Yokohama, Kanagawa','Japan','JP','ja','キリン一番搾り',35.4634,139.622),
  ('Asahi Breweries','Suita, Osaka','Japan','JP','ja','アサヒスーパードライ',34.7615,135.5158),
  ('Red Stripe (D&G)','Kingston, Surrey','Jamaica','JM','en',null,17.9972,-76.7939),
  ('Estrella Galicia','A Coruña, Galicia','Spain','ES','es',null,43.3623,-8.4115),
  ('Pilsner Urquell','Pilsen, Bohemia','Czech Republic','CZ','cs','Plzeňský Prazdroj',49.7479,13.3756),
  ('Birra Moretti (Heineken Italia)','Udine, Friuli-Venezia Giulia','Italy','IT','it',null,46.064,13.235),
  ('Erdinger Weissbräu','Erding, Bavaria','Germany','DE','de',null,48.3063,11.9071),
  ('Industrial Arts Brewing','Garnerville, New York','USA','US','en',null,41.2065,-74.0085),
  ('Żywiec Brewery (Grupa Żywiec)','Żywiec, Silesia','Poland','PL','pl',null,49.6853,19.1925),
  ('Birra Peroni','Rome, Lazio','Italy','IT','it',null,41.8902,12.4922),
  ('S.A. Damm','Barcelona, Catalonia','Spain','ES','es',null,41.3897,2.154),
  ('Abbaye de Leffe (AB InBev)','Dinant, Namur','Belgium','BE','fr',null,50.2611,4.9122),
  ('Texelse Bierbrouwerij','Oudeschild, North Holland','Netherlands','NL','nl',null,53.0385,4.851),
  ('Affligem Brewery (Heineken)','Opwijk, Flemish Brabant','Belgium','BE','nl',null,50.9786,4.1868),
  ('De Koninck Brewery','Antwerp, Antwerp','Belgium','BE','nl',null,51.2157,4.4156),
  ('Brouwerij ''t IJ','Amsterdam, Noord-Holland','Netherlands','NL','nl',null,52.3657,4.9196),
  ('Brasserie d''Achouffe','Achouffe, Luxembourg Province (Wallonia)','Belgium','BE','fr',null,50.1417,5.8125),
  ('Stieglbrauerei zu Salzburg','Salzburg, Land Salzburg','Austria','AT','de',null,47.8095,13.055),
  ('Super Bock Group','Leça do Balio, Porto','Portugal','PT','pt',null,41.2142,-8.6254),
  ('Latrobe Brewing Company','Latrobe, Pennsylvania','USA','US','en',null,40.3215,-79.3795),
  ('Cervecería Cuauhtémoc Moctezuma','Monterrey, Nuevo León','Mexico','MX','es',null,25.6866,-100.3161),
  ('Miller Brewing Company','Milwaukee, Wisconsin','USA','US','en',null,43.0389,-87.9065),
  ('Belhaven Brewery','Dunbar, East Lothian','Scotland','GB-SCT','en',null,56.0006,-2.5176),
  ('Boston Beer Company (Samuel Adams)','Boston, Massachusetts','USA','US','en',null,42.3601,-71.0589),
  ('Cervecería del Pacífico','Mazatlán, Sinaloa','Mexico','MX','es',null,23.2494,-106.4111),
  ('Narragansett Brewing Company','Cranston, Rhode Island','USA','US','en',null,41.7798,-71.4373),
  ('Kona Brewing Company','Kailua-Kona, Hawaii','USA','US','en',null,19.6406,-155.9969),
  ('Blue Moon Brewing Company','Denver, Colorado','USA','US','en',null,39.7392,-104.9903),
  ('Smithwick''s (St. Francis Abbey)','Kilkenny, Leinster','Ireland','IE','en',null,52.6541,-7.2448),
  ('Captain Lawrence Brewing Company','Elmsford, New York','USA','US','en',null,41.054,-73.8201),
  ('Paulaner Brauerei','Munich, Bavaria','Germany','DE','de',null,48.1234,11.5808),
  ('Compañía Cervecera de Puerto Rico','Mayagüez, Puerto Rico','Puerto Rico','PR','es',null,18.2011,-67.1397),
  ('Ocean Lab Brewing Co.','Carolina (Isla Verde), Puerto Rico','Puerto Rico','PR','es',null,18.4486,-66.0203),
  ('Flying Dog Brewery','Frederick, Maryland','USA','US','en',null,39.4143,-77.4105),
  ('Goose Island Beer Co.','Chicago, Illinois','USA','US','en',null,41.9166,-87.653),
  ('Brasserie Almaza','Beirut, Beirut Governorate','Lebanon','LB','ar','ألمازة',33.8938,35.5018),
  ('Olympic Brewery','Sindos, Central Macedonia','Greece','GR','el',null,40.6736,22.8064),
  ('Stone Brewing','Escondido, California','USA','US','en',null,33.1192,-117.0864),
  ('Mahou (Grupo Mahou-San Miguel)','Madrid, Madrid','Spain','ES','es',null,40.4168,-3.7038),
  ('Cervecería Hatuey (Bacardí)','Santiago de Cuba, Santiago de Cuba','Cuba','CU','es','Cerveza Hatuey',20.0247,-75.8219),
  ('Boddington''s Brewery','Manchester, Greater Manchester','England','GB-ENG','en',null,53.4808,-2.2426),
  ('Spaten-Franziskaner-Bräu','Munich, Bavaria','Germany','DE','de',null,48.1494,11.5567),
  ('Dortmunder Actien-Brauerei (DAB)','Dortmund, North Rhine-Westphalia','Germany','DE','de',null,51.5136,7.4653),
  ('Brauerei Beck & Co.','Bremen, Bremen','Germany','DE','de',null,53.0793,8.8017),
  ('Birra Ichnusa (Heineken Italia)','Assemini, Sardinia','Italy','IT','it',null,39.2803,9.0057),
  ('Bitburger Braugruppe','Bitburg, Rhineland-Palatinate','Germany','DE','de',null,49.9739,6.5334),
  ('Radeberger Exportbierbrauerei','Radeberg, Saxony','Germany','DE','de',null,51.1136,13.9169),
  ('Cervecería Nacional Dominicana','Santo Domingo, Distrito Nacional','Dominican Republic','DO','es',null,18.4861,-69.9312)
on conflict (name) do update set location = excluded.location, country = excluded.country, cc = excluded.cc, lang = excluded.lang, native_name = excluded.native_name, lat = excluded.lat, lng = excluded.lng;

-- The reviews already in the table keep their rows; they gain the two
-- columns that did not exist when they were written.
update public.beers b
   set seq = s.seq, logo = s.logo
  from (values
  (1::int,'Grolsch'::text,'Grolsch'::text,'Pilsner'::text,'NL'::text,5::numeric,'Bottle'::text,'Hengelo'::text,'Overijssel'::text,'Netherlands'::text,'NL'::text,3.5::numeric,false::boolean,'2026-01-01'::date,null::text),
  (2,'Hertog Jan','Bavaria NV (Hertog Jan)','Pilsner','NL',5.1,'Bottle','Hengelo','Overijssel','Netherlands','NL',2,false,'2026-01-01',null),
  (3,'Coors Light','Molson Coors','Lager','US',4.2,'Can','New Rochelle','New York','USA','US',3,false,'2026-01-01',null),
  (4,'Sapporo Premium','Sapporo Brewery','Lager','JP',4.9,'Bottle','Hartsdale','New York','USA','US',3.5,false,'2026-01-01',null),
  (5,'Kirin Ichiban','Kirin Brewery','Lager','JP',5,'Bottle','Hartsdale','New York','USA','US',3,false,'2026-01-01',null),
  (6,'Modelo Especial','Grupo Modelo','Lager','MX',4.5,'Bottle','White Plains','New York','USA','US',3.25,false,'2026-01-01',null),
  (7,'Stella Artois','AB InBev (Stella)','Lager','BE',5,'Bottle','Eastchester','New York','USA','US',2.75,false,'2026-01-01',null),
  (8,'Duvel','Duvel Moortgat','Belgian Ale','BE',8.5,'Bottle','Amsterdam','Noord-Holland','Netherlands','NL',4.25,false,'2026-01-01',null),
  (9,'Carlsberg','Carlsberg','Pilsner','DK',5,'Draft','Montreal','Quebec','Canada','CA',3,false,'2026-01-01',null),
  (10,'Harp Lager','Harp / Diageo','Lager','IE',4.5,'Draft','Montreal','Quebec','Canada','CA',4.25,false,'2026-01-01',null),
  (11,'Kronenbourg 1664','Kronenbourg','Lager','FR',5.5,'Draft','Montreal','Quebec','Canada','CA',3,false,'2026-01-01',null),
  (12,'Michelob Ultra','Anheuser-Busch','Lager','US',4.2,'Can','White Plains','New York','USA','US',2.5,false,'2026-01-01',null),
  (13,'Red Stripe','Red Stripe (D&G)','Lager','JM',4.7,'Bottle','Clemson','South Carolina','USA','US',3.75,false,'2026-01-01',null),
  (14,'Heineken','Heineken','Lager','NL',5,'Draft','Uncasville','Connecticut','USA','US',3.25,false,'2026-02-01',null),
  (15,'Guinness Draught','Guinness (St. James''s Gate)','Stout','IE',4.2,'Nitro','Eastchester','New York','USA','US',4,false,'2026-02-01',null),
  (16,'Weihenstephaner Hefeweissbier','Weihenstephaner','Wheat Beer','DE',5.4,'Bottle','New Rochelle','New York','USA','US',4.5,false,'2026-02-01',null),
  (17,'Hofbräu Münchner Weiße','Hofbräu München','Wheat Beer','DE',5.1,'Draft','New York','New York','USA','US',4.75,false,'2026-02-01',null),
  (18,'Negra Modelo','Grupo Modelo','Lager','MX',5.4,'Bottle','New Rochelle','New York','USA','US',3,false,'2026-02-01',null),
  (19,'Hofbräu Dunkel','Hofbräu München','Lager','DE',5.5,'Draft','New York','New York','USA','US',2.75,false,'2026-02-01',null),
  (20,'Bud Light','Anheuser-Busch','Lager','US',4.2,'Bottle','East Rutherford','New Jersey','USA','US',3,true,'2026-02-01',null),
  (21,'Budweiser','Anheuser-Busch','Lager','US',5,'Bottle','New York','New York','USA','US',3,true,'2026-02-01',null),
  (22,'Corona Extra','Grupo Modelo','Lager','MX',4.5,'Bottle','New Rochelle','New York','USA','US',3.75,false,'2026-02-01',null),
  (23,'Birra Moretti','Birra Moretti (Heineken Italia)','Lager','IT',4.6,'Bottle','Sciara','Sicily','Italy','IT',3.75,true,'2026-02-01',null),
  (24,'Erdinger Weißbier','Erdinger Weissbräu','Wheat Beer','DE',5.3,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-02-01',null),
  (25,'Estrella Galicia','Estrella Galicia','Lager','ES',5.5,'Bottle','Madrid','Madrid','Spain','ES',4.25,true,'2026-03-01',null),
  (26,'Pilsner Urquell','Pilsner Urquell','Pilsner','CZ',4.4,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-03-01',null),
  (27,'Wrench','Industrial Arts Brewing','IPA','US',7.1,'Can','New Rochelle','New York','USA','US',4,true,'2026-03-01',null),
  (28,'La Fin Du Monde','Unibroue','Belgian Ale','CA',9,'Bottle','Montreal','Quebec','Canada','CA',3.75,false,'2026-03-01',null),
  (29,'Żywiec','Żywiec Brewery (Grupa Żywiec)','Lager','PL',5.5,'Bottle','New Rochelle','New York','USA','US',2.75,true,'2026-03-01',null),
  (30,'Estrella Damm','S.A. Damm','Lager','ES',5.4,'Bottle','Barcelona','Catalonia','Spain','ES',3.5,true,'2026-03-01',null),
  (31,'Grolsch Puur Weizen','Grolsch','Wheat Beer','NL',5.1,'Draft','Oldenzaal','Overijssel','Netherlands','NL',5,true,'2026-03-01',null),
  (32,'Frisse Lentebok','Grolsch','Lager','NL',6.5,'Bottle','Hengelo','Overijssel','Netherlands','NL',3.25,true,'2026-03-01',null),
  (33,'Leffe Blonde','Abbaye de Leffe (AB InBev)','Belgian Ale','BE',6.6,'Draft','Nijmegen','Gelderland','Netherlands','NL',4.75,false,'2026-03-01',null),
  (34,'Texels Skuumkoppe','Texelse Bierbrouwerij','Wheat Beer','NL',6,'Bottle','Nijmegen','Gelderland','Netherlands','NL',3,true,'2026-03-01',null),
  (35,'Affligem Tripel','Affligem Brewery (Heineken)','Belgian Ale','BE',9,'Draft','Antwerp','Antwerp','Belgium','BE',3.75,true,'2026-03-01',null),
  (36,'De Koninck','De Koninck Brewery','Pale Ale','BE',5.2,'Draft','Antwerp','Antwerp','Belgium','BE',2.75,true,'2026-03-01',null),
  (37,'IJwit','Brouwerij ''t IJ','Wheat Beer','NL',6.5,'Draft','Antwerp','Antwerp','Belgium','BE',3.75,true,'2026-03-01',null),
  (38,'La Chouffe Blonde','Brasserie d''Achouffe','Belgian Ale','BE',8,'Bottle','New Rochelle','New York','USA','US',4.25,true,'2026-03-01',null),
  (39,'Stiegl Goldbräu','Stieglbrauerei zu Salzburg','Lager','AT',5,'Bottle','New Rochelle','New York','USA','US',2.75,true,'2026-03-01',null),
  (40,'Modelo Oro','Grupo Modelo','Lager','MX',4,'Can','New Rochelle','New York','USA','US',3,true,'2026-03-01',null),
  (41,'Super Bock','Super Bock Group','Lager','PT',5.2,'Bottle','Lagos','Algarve','Portugal','PT',3,true,'2026-04-01',null),
  (42,'Estrella Jalisco','Cervecería Estrella Jalisco','Lager','MX',4.5,'Bottle','New Rochelle','New York','USA','US',3.75,true,'2026-04-01','https://pennbeer.com/app/uploads/2021/06/ynaOvePfbmJEMed-400x400-noPad-300x300.png'),
  (43,'Rolling Rock Extra Pale','Latrobe Brewing Company','Lager','US',4.4,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-04-01',null),
  (44,'Carlsberg Elephant','Carlsberg','Lager','DK',7.2,'Bottle','New Rochelle','New York','USA','US',3.5,true,'2026-04-01',null),
  (45,'Dos Equis Lager Especial','Cervecería Cuauhtémoc Moctezuma','Lager','MX',4.2,'Draft','Queens','New York','USA','US',1.75,true,'2026-04-01','https://thebrandinquirer.wordpress.com/wp-content/uploads/2021/05/dos-equis-nueva-imagen-logo-new-design-.jpg?w=1024'),
  (46,'Miller Lite','Miller Brewing Company','Lager','US',4.2,'Bottle','New Rochelle','New York','USA','US',2.25,true,'2026-04-01',null),
  (47,'Belhaven Scottish Stout','Belhaven Brewery','Stout','GB-SCT',5.2,'Nitro','Boston','Massachusetts','USA','US',3,true,'2026-05-01',null),
  (48,'Samuel Adams Summer Ale','Boston Beer Company (Samuel Adams)','Wheat Beer','US',5.3,'Draft','Boston','Massachusetts','USA','US',3,true,'2026-05-01',null),
  (49,'Pacífico Clara','Cervecería del Pacífico','Lager','MX',4.5,'Bottle','Clemson','South Carolina','USA','US',3.75,true,'2026-05-01','https://upload.wikimedia.org/wikipedia/en/f/f7/Pacifico_Logo.png'),
  (50,'Narragansett Lager','Narragansett Brewing Company','Lager','US',5,'Can','New York','New York','USA','US',3.25,true,'2026-05-01',null),
  (51,'Big Wave Golden Ale','Kona Brewing Company','Pale Ale','US',4.4,'Can','New York','New York','USA','US',3.75,true,'2026-05-01',null),
  (52,'Smithwick''s','Smithwick''s (St. Francis Abbey)','Red Ale','IE',4.5,'Draft','White Plains','New York','USA','US',2.75,true,'2026-05-01',null),
  (53,'Daura','S.A. Damm','Lager','ES',5.4,'Bottle','New York','New York','USA','US',3,true,'2026-05-01','logos/daura.svg'),
  (54,'Asahi Super Dry','Asahi Breweries','Lager','JP',5,'Bottle','Eastchester','New York','USA','US',3.5,true,'2026-05-01',null),
  (55,'Blue Moon','Blue Moon Brewing Company','Wheat Beer','US',5.4,'Draft','New York','New York','USA','US',3.5,true,'2026-05-01',null),
  (56,'Hop Commander','Captain Lawrence Brewing Company','IPA','US',6.5,'Draft','New York','New York','USA','US',3,true,'2026-06-01',null),
  (57,'Paulaner Hefe-Weißbier','Paulaner Brauerei','Wheat Beer','DE',5.5,'Bottle','New York','New York','USA','US',4,true,'2026-06-01',null),
  (58,'Medalla Light','Compañía Cervecera de Puerto Rico','Lager','PR',4.2,'Bottle','San Juan','San Juan','Puerto Rico','PR',4,true,'2026-06-01',null),
  (59,'Magna','Compañía Cervecera de Puerto Rico','Lager','PR',4.5,'Bottle','San Juan','San Juan','Puerto Rico','PR',4,true,'2026-06-01',null),
  (60,'Ocean SJU','Ocean Lab Brewing Co.','Lager','PR',5.9,'Bottle','San Juan','San Juan','Puerto Rico','PR',2.5,true,'2026-06-01',null),
  (61,'Bloodline Blood Orange IPA','Flying Dog Brewery','IPA','US',8,'Bottle','San Juan','San Juan','Puerto Rico','PR',3.5,true,'2026-06-01',null),
  (62,'Goose IPA','Goose Island Beer Co.','IPA','US',5.9,'Can','Washington','District of Columbia','USA','US',3.5,true,'2026-06-01',null),
  (63,'Almaza Pilsener','Brasserie Almaza','Pilsner','LB',4.2,'Bottle','Washington','District of Columbia','USA','US',2.75,true,'2026-06-01',null),
  (64,'Mythos','Olympic Brewery','Lager','GR',5,'Bottle','Washington','District of Columbia','USA','US',3.25,true,'2026-06-01',null),
  (65,'Stone IPA','Stone Brewing','IPA','US',6.9,'Can','New Rochelle','New York','USA','US',2.5,true,'2026-07-01',null),
  (66,'Mahou Cinco Estrellas','Mahou (Grupo Mahou-San Miguel)','Lager','ES',5.5,'Bottle','Boynton Beach','Florida','USA','US',3.5,true,'2026-07-01',null),
  (67,'Hatuey Lager','Cervecería Hatuey (Bacardí)','Lager','CU',5,'Bottle','Miami','Florida','USA','US',4,true,'2026-07-01',null),
  (68,'Pub Ale','Boddington''s Brewery','Pale Ale','GB-ENG',4.7,'Can','New Rochelle','New York','USA','US',4.25,true,'2026-07-01',null),
  (69,'Spaten Oktoberfest Ur-Märzen / Winter','Spaten-Franziskaner-Bräu','Lager','DE',5.9,'Draft','New York','New York','USA','US',2.75,true,'2026-07-01',null),
  (70,'Peroni Nastro Azzurro','Birra Peroni','Lager','IT',5.1,'Bottle','Ischia','Campania','Italy','IT',3,true,'2026-08-01',null),
  (71,'DAB Dortmunder Export','Dortmunder Actien-Brauerei (DAB)','Lager','DE',5,'Draft','Ischia','Campania','Italy','IT',4.5,true,'2026-08-01',null),
  (72,'Beck''s','Brauerei Beck & Co.','Pilsner','DE',4.9,'Bottle','Ischia','Campania','Italy','IT',3,true,'2026-08-01',null),
  (73,'Ichnusa Anima Sarda','Birra Ichnusa (Heineken Italia)','Lager','IT',4.7,'Bottle','Ischia','Campania','Italy','IT',3.75,true,'2026-08-01',null),
  (74,'Chill Lemon','Birra Peroni','Shandy / Radler','IT',2,'Bottle','Capri','Campania','Italy','IT',4,true,'2026-08-01',null),
  (75,'Peroni Original','Birra Peroni','Lager','IT',4.7,'Bottle','Ischia','Campania','Italy','IT',3.25,true,'2026-08-01',null),
  (76,'Bitburger Radler','Bitburger Braugruppe','Shandy / Radler','DE',2.5,'Can','New Rochelle','New York','USA','US',4,true,'2026-08-01',null),
  (77,'Radeberger Pilsner','Radeberger Exportbierbrauerei','Pilsner','DE',4.8,'Bottle','White Plains','New York','USA','US',3,true,'2026-08-01',null),
  (78,'Presidente','Cervecería Nacional Dominicana','Pilsner','DO',5,'Bottle','New Rochelle','New York','USA','US',3,true,'2026-08-01',null),
  (79,'Heineken Silver','Heineken','Lager','NL',4,'Draft','Queens','New York','USA','US',3,true,'2026-08-01',null)
) as s(seq,name,brewery,style,origin_cc,abv,method,city,region,country,cc,rating,is_new,drank_on,logo)
 where b.name = s.name and b.drank_on = s.drank_on and b.seq is null;

-- Any review data.js has that the table does not.
insert into public.beers (seq,name,brewery,style,origin_cc,abv,method,city,region,country,cc,rating,is_new,drank_on,logo)
select s.seq,s.name,s.brewery,s.style,s.origin_cc,s.abv,s.method,s.city,s.region,s.country,s.cc,s.rating,s.is_new,s.drank_on,s.logo
  from (values
  (1::int,'Grolsch'::text,'Grolsch'::text,'Pilsner'::text,'NL'::text,5::numeric,'Bottle'::text,'Hengelo'::text,'Overijssel'::text,'Netherlands'::text,'NL'::text,3.5::numeric,false::boolean,'2026-01-01'::date,null::text),
  (2,'Hertog Jan','Bavaria NV (Hertog Jan)','Pilsner','NL',5.1,'Bottle','Hengelo','Overijssel','Netherlands','NL',2,false,'2026-01-01',null),
  (3,'Coors Light','Molson Coors','Lager','US',4.2,'Can','New Rochelle','New York','USA','US',3,false,'2026-01-01',null),
  (4,'Sapporo Premium','Sapporo Brewery','Lager','JP',4.9,'Bottle','Hartsdale','New York','USA','US',3.5,false,'2026-01-01',null),
  (5,'Kirin Ichiban','Kirin Brewery','Lager','JP',5,'Bottle','Hartsdale','New York','USA','US',3,false,'2026-01-01',null),
  (6,'Modelo Especial','Grupo Modelo','Lager','MX',4.5,'Bottle','White Plains','New York','USA','US',3.25,false,'2026-01-01',null),
  (7,'Stella Artois','AB InBev (Stella)','Lager','BE',5,'Bottle','Eastchester','New York','USA','US',2.75,false,'2026-01-01',null),
  (8,'Duvel','Duvel Moortgat','Belgian Ale','BE',8.5,'Bottle','Amsterdam','Noord-Holland','Netherlands','NL',4.25,false,'2026-01-01',null),
  (9,'Carlsberg','Carlsberg','Pilsner','DK',5,'Draft','Montreal','Quebec','Canada','CA',3,false,'2026-01-01',null),
  (10,'Harp Lager','Harp / Diageo','Lager','IE',4.5,'Draft','Montreal','Quebec','Canada','CA',4.25,false,'2026-01-01',null),
  (11,'Kronenbourg 1664','Kronenbourg','Lager','FR',5.5,'Draft','Montreal','Quebec','Canada','CA',3,false,'2026-01-01',null),
  (12,'Michelob Ultra','Anheuser-Busch','Lager','US',4.2,'Can','White Plains','New York','USA','US',2.5,false,'2026-01-01',null),
  (13,'Red Stripe','Red Stripe (D&G)','Lager','JM',4.7,'Bottle','Clemson','South Carolina','USA','US',3.75,false,'2026-01-01',null),
  (14,'Heineken','Heineken','Lager','NL',5,'Draft','Uncasville','Connecticut','USA','US',3.25,false,'2026-02-01',null),
  (15,'Guinness Draught','Guinness (St. James''s Gate)','Stout','IE',4.2,'Nitro','Eastchester','New York','USA','US',4,false,'2026-02-01',null),
  (16,'Weihenstephaner Hefeweissbier','Weihenstephaner','Wheat Beer','DE',5.4,'Bottle','New Rochelle','New York','USA','US',4.5,false,'2026-02-01',null),
  (17,'Hofbräu Münchner Weiße','Hofbräu München','Wheat Beer','DE',5.1,'Draft','New York','New York','USA','US',4.75,false,'2026-02-01',null),
  (18,'Negra Modelo','Grupo Modelo','Lager','MX',5.4,'Bottle','New Rochelle','New York','USA','US',3,false,'2026-02-01',null),
  (19,'Hofbräu Dunkel','Hofbräu München','Lager','DE',5.5,'Draft','New York','New York','USA','US',2.75,false,'2026-02-01',null),
  (20,'Bud Light','Anheuser-Busch','Lager','US',4.2,'Bottle','East Rutherford','New Jersey','USA','US',3,true,'2026-02-01',null),
  (21,'Budweiser','Anheuser-Busch','Lager','US',5,'Bottle','New York','New York','USA','US',3,true,'2026-02-01',null),
  (22,'Corona Extra','Grupo Modelo','Lager','MX',4.5,'Bottle','New Rochelle','New York','USA','US',3.75,false,'2026-02-01',null),
  (23,'Birra Moretti','Birra Moretti (Heineken Italia)','Lager','IT',4.6,'Bottle','Sciara','Sicily','Italy','IT',3.75,true,'2026-02-01',null),
  (24,'Erdinger Weißbier','Erdinger Weissbräu','Wheat Beer','DE',5.3,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-02-01',null),
  (25,'Estrella Galicia','Estrella Galicia','Lager','ES',5.5,'Bottle','Madrid','Madrid','Spain','ES',4.25,true,'2026-03-01',null),
  (26,'Pilsner Urquell','Pilsner Urquell','Pilsner','CZ',4.4,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-03-01',null),
  (27,'Wrench','Industrial Arts Brewing','IPA','US',7.1,'Can','New Rochelle','New York','USA','US',4,true,'2026-03-01',null),
  (28,'La Fin Du Monde','Unibroue','Belgian Ale','CA',9,'Bottle','Montreal','Quebec','Canada','CA',3.75,false,'2026-03-01',null),
  (29,'Żywiec','Żywiec Brewery (Grupa Żywiec)','Lager','PL',5.5,'Bottle','New Rochelle','New York','USA','US',2.75,true,'2026-03-01',null),
  (30,'Estrella Damm','S.A. Damm','Lager','ES',5.4,'Bottle','Barcelona','Catalonia','Spain','ES',3.5,true,'2026-03-01',null),
  (31,'Grolsch Puur Weizen','Grolsch','Wheat Beer','NL',5.1,'Draft','Oldenzaal','Overijssel','Netherlands','NL',5,true,'2026-03-01',null),
  (32,'Frisse Lentebok','Grolsch','Lager','NL',6.5,'Bottle','Hengelo','Overijssel','Netherlands','NL',3.25,true,'2026-03-01',null),
  (33,'Leffe Blonde','Abbaye de Leffe (AB InBev)','Belgian Ale','BE',6.6,'Draft','Nijmegen','Gelderland','Netherlands','NL',4.75,false,'2026-03-01',null),
  (34,'Texels Skuumkoppe','Texelse Bierbrouwerij','Wheat Beer','NL',6,'Bottle','Nijmegen','Gelderland','Netherlands','NL',3,true,'2026-03-01',null),
  (35,'Affligem Tripel','Affligem Brewery (Heineken)','Belgian Ale','BE',9,'Draft','Antwerp','Antwerp','Belgium','BE',3.75,true,'2026-03-01',null),
  (36,'De Koninck','De Koninck Brewery','Pale Ale','BE',5.2,'Draft','Antwerp','Antwerp','Belgium','BE',2.75,true,'2026-03-01',null),
  (37,'IJwit','Brouwerij ''t IJ','Wheat Beer','NL',6.5,'Draft','Antwerp','Antwerp','Belgium','BE',3.75,true,'2026-03-01',null),
  (38,'La Chouffe Blonde','Brasserie d''Achouffe','Belgian Ale','BE',8,'Bottle','New Rochelle','New York','USA','US',4.25,true,'2026-03-01',null),
  (39,'Stiegl Goldbräu','Stieglbrauerei zu Salzburg','Lager','AT',5,'Bottle','New Rochelle','New York','USA','US',2.75,true,'2026-03-01',null),
  (40,'Modelo Oro','Grupo Modelo','Lager','MX',4,'Can','New Rochelle','New York','USA','US',3,true,'2026-03-01',null),
  (41,'Super Bock','Super Bock Group','Lager','PT',5.2,'Bottle','Lagos','Algarve','Portugal','PT',3,true,'2026-04-01',null),
  (42,'Estrella Jalisco','Cervecería Estrella Jalisco','Lager','MX',4.5,'Bottle','New Rochelle','New York','USA','US',3.75,true,'2026-04-01','https://pennbeer.com/app/uploads/2021/06/ynaOvePfbmJEMed-400x400-noPad-300x300.png'),
  (43,'Rolling Rock Extra Pale','Latrobe Brewing Company','Lager','US',4.4,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-04-01',null),
  (44,'Carlsberg Elephant','Carlsberg','Lager','DK',7.2,'Bottle','New Rochelle','New York','USA','US',3.5,true,'2026-04-01',null),
  (45,'Dos Equis Lager Especial','Cervecería Cuauhtémoc Moctezuma','Lager','MX',4.2,'Draft','Queens','New York','USA','US',1.75,true,'2026-04-01','https://thebrandinquirer.wordpress.com/wp-content/uploads/2021/05/dos-equis-nueva-imagen-logo-new-design-.jpg?w=1024'),
  (46,'Miller Lite','Miller Brewing Company','Lager','US',4.2,'Bottle','New Rochelle','New York','USA','US',2.25,true,'2026-04-01',null),
  (47,'Belhaven Scottish Stout','Belhaven Brewery','Stout','GB-SCT',5.2,'Nitro','Boston','Massachusetts','USA','US',3,true,'2026-05-01',null),
  (48,'Samuel Adams Summer Ale','Boston Beer Company (Samuel Adams)','Wheat Beer','US',5.3,'Draft','Boston','Massachusetts','USA','US',3,true,'2026-05-01',null),
  (49,'Pacífico Clara','Cervecería del Pacífico','Lager','MX',4.5,'Bottle','Clemson','South Carolina','USA','US',3.75,true,'2026-05-01','https://upload.wikimedia.org/wikipedia/en/f/f7/Pacifico_Logo.png'),
  (50,'Narragansett Lager','Narragansett Brewing Company','Lager','US',5,'Can','New York','New York','USA','US',3.25,true,'2026-05-01',null),
  (51,'Big Wave Golden Ale','Kona Brewing Company','Pale Ale','US',4.4,'Can','New York','New York','USA','US',3.75,true,'2026-05-01',null),
  (52,'Smithwick''s','Smithwick''s (St. Francis Abbey)','Red Ale','IE',4.5,'Draft','White Plains','New York','USA','US',2.75,true,'2026-05-01',null),
  (53,'Daura','S.A. Damm','Lager','ES',5.4,'Bottle','New York','New York','USA','US',3,true,'2026-05-01','logos/daura.svg'),
  (54,'Asahi Super Dry','Asahi Breweries','Lager','JP',5,'Bottle','Eastchester','New York','USA','US',3.5,true,'2026-05-01',null),
  (55,'Blue Moon','Blue Moon Brewing Company','Wheat Beer','US',5.4,'Draft','New York','New York','USA','US',3.5,true,'2026-05-01',null),
  (56,'Hop Commander','Captain Lawrence Brewing Company','IPA','US',6.5,'Draft','New York','New York','USA','US',3,true,'2026-06-01',null),
  (57,'Paulaner Hefe-Weißbier','Paulaner Brauerei','Wheat Beer','DE',5.5,'Bottle','New York','New York','USA','US',4,true,'2026-06-01',null),
  (58,'Medalla Light','Compañía Cervecera de Puerto Rico','Lager','PR',4.2,'Bottle','San Juan','San Juan','Puerto Rico','PR',4,true,'2026-06-01',null),
  (59,'Magna','Compañía Cervecera de Puerto Rico','Lager','PR',4.5,'Bottle','San Juan','San Juan','Puerto Rico','PR',4,true,'2026-06-01',null),
  (60,'Ocean SJU','Ocean Lab Brewing Co.','Lager','PR',5.9,'Bottle','San Juan','San Juan','Puerto Rico','PR',2.5,true,'2026-06-01',null),
  (61,'Bloodline Blood Orange IPA','Flying Dog Brewery','IPA','US',8,'Bottle','San Juan','San Juan','Puerto Rico','PR',3.5,true,'2026-06-01',null),
  (62,'Goose IPA','Goose Island Beer Co.','IPA','US',5.9,'Can','Washington','District of Columbia','USA','US',3.5,true,'2026-06-01',null),
  (63,'Almaza Pilsener','Brasserie Almaza','Pilsner','LB',4.2,'Bottle','Washington','District of Columbia','USA','US',2.75,true,'2026-06-01',null),
  (64,'Mythos','Olympic Brewery','Lager','GR',5,'Bottle','Washington','District of Columbia','USA','US',3.25,true,'2026-06-01',null),
  (65,'Stone IPA','Stone Brewing','IPA','US',6.9,'Can','New Rochelle','New York','USA','US',2.5,true,'2026-07-01',null),
  (66,'Mahou Cinco Estrellas','Mahou (Grupo Mahou-San Miguel)','Lager','ES',5.5,'Bottle','Boynton Beach','Florida','USA','US',3.5,true,'2026-07-01',null),
  (67,'Hatuey Lager','Cervecería Hatuey (Bacardí)','Lager','CU',5,'Bottle','Miami','Florida','USA','US',4,true,'2026-07-01',null),
  (68,'Pub Ale','Boddington''s Brewery','Pale Ale','GB-ENG',4.7,'Can','New Rochelle','New York','USA','US',4.25,true,'2026-07-01',null),
  (69,'Spaten Oktoberfest Ur-Märzen / Winter','Spaten-Franziskaner-Bräu','Lager','DE',5.9,'Draft','New York','New York','USA','US',2.75,true,'2026-07-01',null),
  (70,'Peroni Nastro Azzurro','Birra Peroni','Lager','IT',5.1,'Bottle','Ischia','Campania','Italy','IT',3,true,'2026-08-01',null),
  (71,'DAB Dortmunder Export','Dortmunder Actien-Brauerei (DAB)','Lager','DE',5,'Draft','Ischia','Campania','Italy','IT',4.5,true,'2026-08-01',null),
  (72,'Beck''s','Brauerei Beck & Co.','Pilsner','DE',4.9,'Bottle','Ischia','Campania','Italy','IT',3,true,'2026-08-01',null),
  (73,'Ichnusa Anima Sarda','Birra Ichnusa (Heineken Italia)','Lager','IT',4.7,'Bottle','Ischia','Campania','Italy','IT',3.75,true,'2026-08-01',null),
  (74,'Chill Lemon','Birra Peroni','Shandy / Radler','IT',2,'Bottle','Capri','Campania','Italy','IT',4,true,'2026-08-01',null),
  (75,'Peroni Original','Birra Peroni','Lager','IT',4.7,'Bottle','Ischia','Campania','Italy','IT',3.25,true,'2026-08-01',null),
  (76,'Bitburger Radler','Bitburger Braugruppe','Shandy / Radler','DE',2.5,'Can','New Rochelle','New York','USA','US',4,true,'2026-08-01',null),
  (77,'Radeberger Pilsner','Radeberger Exportbierbrauerei','Pilsner','DE',4.8,'Bottle','White Plains','New York','USA','US',3,true,'2026-08-01',null),
  (78,'Presidente','Cervecería Nacional Dominicana','Pilsner','DO',5,'Bottle','New Rochelle','New York','USA','US',3,true,'2026-08-01',null),
  (79,'Heineken Silver','Heineken','Lager','NL',4,'Draft','Queens','New York','USA','US',3,true,'2026-08-01',null)
) as s(seq,name,brewery,style,origin_cc,abv,method,city,region,country,cc,rating,is_new,drank_on,logo)
 where not exists (
   select 1 from public.beers b where b.name = s.name and b.drank_on = s.drank_on
 );

insert into public.brand_domains (beer_name,domains) values
  ('Affligem Tripel'::text,array['affligembeer.be']::text[]),
  ('Almaza Pilsener',array['almaza.com']),
  ('Asahi Super Dry',array['asahibeer.com']),
  ('Augustiner Helles',array['augustiner-braeu.de']),
  ('Big Wave Golden Ale',array['konabrewingco.com']),
  ('Beck''s',array['becks.de']),
  ('Birra Moretti',array['birramoretti.com']),
  ('Ichnusa Anima Sarda',array['ichnusa.com']),
  ('Bitburger Radler',array['bitburger.de']),
  ('Bloodline Blood Orange IPA',array['flyingdog.com']),
  ('Blue Moon',array['bluemoonbrewingcompany.com']),
  ('De Koninck',array['dekoninck.be']),
  ('Brahma',array['brahma.com.br']),
  ('Bud Light',array['budlight.com']),
  ('Budweiser',array['budweiser.com']),
  ('Carlsberg',array['carlsberg.com']),
  ('Carlsberg Elephant',array['carlsberg.com']),
  ('Castle Lager',array['castlelager.co.za','castlelager.com']),
  ('Chill Lemon',array['peroni.it']),
  ('Chimay Blue',array['chimay.com']),
  ('Coopers Pale Ale',array['coopers.com.au']),
  ('Coors Light',array['coorslight.com']),
  ('Corona Extra',array['coronausa.com']),
  ('DAB Dortmunder Export',array['dab.de']),
  ('Dos Equis Lager Especial',array['dosequis.com']),
  ('Daura',array['estrelladamm.com']),
  ('Duvel',array['duvel.com']),
  ('Erdinger Weißbier',array['erdinger.de']),
  ('Estrella Damm',array['estrelladamm.com']),
  ('Estrella Galicia',array['estrellagalicia.com']),
  ('Estrella Jalisco',array['estrellajalisco.com']),
  ('Goose IPA',array['gooseisland.com']),
  ('Grolsch',array['grolsch.com']),
  ('Grolsch Puur Weizen',array['grolsch.com']),
  ('Frisse Lentebok',array['grolsch.com']),
  ('Guinness Draught',array['guinness.com']),
  ('Harp Lager',array['harplager.com','harp.ie']),
  ('Hatuey Lager',array['hatuey.com','hatueybeer.com']),
  ('Heineken',array['heineken.com']),
  ('Heineken Silver',array['heinekensilver.com','heineken.com']),
  ('Hertog Jan',array['hertogjan.nl']),
  ('Hoegaarden',array['hoegaarden.com']),
  ('IJwit',array['brouwerijhetij.nl']),
  ('Kirin Ichiban',array['kirin.co.jp']),
  ('Kronenbourg 1664',array['1664.com','kronenbourg1664.com']),
  ('La Chouffe Blonde',array['achouffe.be']),
  ('La Fin Du Monde',array['unibroue.com']),
  ('Leffe Blonde',array['leffe.com']),
  ('Magna',array['cerveceradepr.com']),
  ('Mahou Cinco Estrellas',array['mahou.es']),
  ('Medalla Light',array['medallalight.com']),
  ('Menabrea',array['birramenabrea.com']),
  ('Michelob Ultra',array['michelobultra.com']),
  ('Miller Lite',array['millerlite.com']),
  ('Modelo Especial',array['modelousa.com']),
  ('Negra Modelo',array['modelousa.com']),
  ('Modelo Oro',array['modelousa.com']),
  ('Mythos',array['mythosbrewery.gr']),
  ('Hofbräu Dunkel',array['hofbraeu-muenchen.de']),
  ('Hop Commander',array['captainlawrencebrewing.com']),
  ('Hofbräu Münchner Weiße',array['hofbraeu-muenchen.de']),
  ('Narragansett Lager',array['narragansettbeer.com']),
  ('Peroni Nastro Azzurro',array['peroni.it']),
  ('Peroni Original',array['peroni.it']),
  ('Newcastle Brown Ale',array['newcastlebrown.com','newcastlebrownale.com']),
  ('Norrlands Guld',array['norrlandsguld.se']),
  ('Ocean SJU',array['oceanlabbrewing.com']),
  ('Orion',array['orionbeer.co.jp']),
  ('Pacífico Clara',array['drinkpacifico.com']),
  ('Paulaner Hefe',array['paulaner.com']),
  ('Paulaner Hefe-Weißbier',array['paulaner.com']),
  ('Pilsner Urquell',array['pilsnerurquell.com','prazdroj.cz']),
  ('Pub Ale',array['boddingtons.co.uk','boddingtons.com']),
  ('Presidente',array['presidente.com.do','cnd.com.do']),
  ('Quilmes',array['quilmes.com.ar']),
  ('Radeberger Pilsner',array['radeberger.de']),
  ('Red Stripe',array['redstripebeer.com']),
  ('Ringnes',array['ringnes.no']),
  ('Rolling Rock Extra Pale',array['rollingrock.com']),
  ('Sam Adams Boston Lager',array['samueladams.com']),
  ('Sapporo Premium',array['sapporobeer.com']),
  ('Belhaven Scottish Stout',array['belhaven.co.uk']),
  ('Singha',array['singhabeer.com']),
  ('Smithwick''s',array['smithwicks.com','smithwicks.ie']),
  ('Sol',array['solbeer.com','cervezasol.com']),
  ('Spaten Oktoberfest Ur-Märzen / Winter',array['spatenbraeu.de','spaten.de']),
  ('Stella Artois',array['stellaartois.com']),
  ('Stiegl Goldbräu',array['stiegl.at']),
  ('Stone IPA',array['stonebrewing.com']),
  ('Samuel Adams Summer Ale',array['samueladams.com']),
  ('Super Bock',array['superbock.pt']),
  ('Tennent''s',array['tennents.com','tennents.co.uk']),
  ('Texels Skuumkoppe',array['texels.nl']),
  ('Tiger Beer',array['tigerbeer.com']),
  ('Tsingtao',array['tsingtaobeer.com']),
  ('Tuborg',array['tuborg.com']),
  ('Tyskie',array['tyskie.pl']),
  ('Victoria Bitter',array['vb.com.au','victoriabitter.com.au']),
  ('Weihenstephaner Hefeweissbier',array['weihenstephaner.de']),
  ('Wrench',array['industrialartsbrewing.com']),
  ('Żywiec',array['zywiec.com.pl'])
on conflict (beer_name) do nothing;

insert into public.want_to_try (seq,beer,style,origin,abv,region,untappd,method,aka) values
  (1::int,'Paulaner Hefe'::text,'Wheat Beer'::text,'DE'::text,5.5::numeric,'Munich, Bavaria'::text,3.87::numeric,'Bottle'::text,array['Paulaner Hefe-Weißbier']::text[]),
  (2,'Augustiner Helles','Lager','DE',5.2,'Munich, Bavaria',4.1,'Draft',null),
  (3,'Birra Moretti','Lager','IT',4.6,'Udine, Friuli-Venezia Giulia',3.58,'Bottle',null),
  (4,'Peroni Nastro Azzurro','Lager','IT',5.1,'Rome, Lazio',3.56,'Bottle',null),
  (5,'Menabrea','Lager','IT',4.8,'Biella, Piedmont',3.55,'Bottle',null),
  (6,'Estrella Galicia','Lager','ES',5.5,'A Coruña, Galicia',3.65,'Bottle',null),
  (7,'Estrella Damm','Lager','ES',5.4,'Barcelona, Catalonia',3.61,'Bottle',null),
  (8,'Pilsner Urquell','Pilsner','CZ',4.4,'Pilsen, Bohemia',3.8,'Bottle',null),
  (9,'Żywiec','Lager','PL',5.5,'Żywiec, Silesia',3.35,'Bottle',null),
  (10,'Tyskie','Pilsner','PL',5.6,'Tychy, Silesia',3.28,'Can',null),
  (11,'Chimay Blue','Belgian Ale','BE',9,'Chimay, Hainaut',4.05,'Bottle',null),
  (12,'Leffe Blonde','Belgian Ale','BE',6.6,'Dinant, Namur',3.75,'Bottle',null),
  (13,'Hoegaarden','Wheat Beer','BE',4.9,'Hoegaarden, Flemish Brabant',3.72,'Bottle',null),
  (14,'Kronenbourg 1664','Lager','FR',5.5,'Obernai, Alsace',3.3,'Can',null),
  (15,'Super Bock','Lager','PT',5.2,'Leça do Balio, Porto',3.41,'Bottle',null),
  (16,'Mythos','Lager','GR',4.7,'Athens, Attica',3.31,'Bottle',null),
  (17,'Tuborg','Pilsner','DK',4.6,'Copenhagen',3.1,'Can',null),
  (18,'Norrlands Guld','Lager','SE',5.3,'Stockholm',3.28,'Can',null),
  (19,'Ringnes','Lager','NO',4.7,'Oslo',3.1,'Can',null),
  (20,'Newcastle Brown Ale','Brown Ale','GB-ENG',4.7,'Tadcaster, Yorkshire',3.28,'Bottle',null),
  (21,'Tennent''s','Lager','GB-SCT',4,'Glasgow, Scotland',2.95,'Can',null),
  (22,'Smithwick''s','Red Ale','IE',4.5,'Kilkenny, Leinster',3.45,'Draft',null),
  (23,'Blue Moon','Wheat Beer','US',5.4,'Denver, Colorado',3.56,'Draft',null),
  (24,'Sam Adams Boston Lager','Lager','US',5,'Boston, Massachusetts',3.48,'Bottle',null),
  (25,'Miller Lite','Lager','US',4.2,'Milwaukee, Wisconsin',2.51,'Can',null),
  (26,'Sol','Lager','MX',4.5,'Mexico City',3.15,'Bottle',null),
  (27,'Brahma','Lager','BR',4.8,'São Paulo, SP',3.18,'Can',null),
  (28,'Quilmes','Lager','AR',4.9,'Buenos Aires, BA',3.22,'Bottle',null),
  (29,'Asahi Super Dry','Lager','JP',5,'Tokyo',3.6,'Bottle',null),
  (30,'Orion','Lager','JP',5,'Naha, Okinawa',3.42,'Can',null),
  (31,'Tsingtao','Lager','CN',4.7,'Qingdao, Shandong',3.29,'Bottle',null),
  (32,'Singha','Lager','TH',5,'Bangkok',3.25,'Bottle',null),
  (33,'Tiger Beer','Lager','SG',5,'Singapore',3.18,'Can',null),
  (34,'Coopers Pale Ale','Pale Ale','AU',4.5,'Adelaide, South Australia',3.72,'Bottle',null),
  (35,'Victoria Bitter','Lager','AU',4.9,'Melbourne, Victoria',3.12,'Can',null),
  (36,'Castle Lager','Lager','ZA',5,'Johannesburg, Gauteng',3.18,'Can',null)
on conflict (beer) do nothing;

insert into public.untappd_averages (beer_name,avg) values
  ('Grolsch'::text,3.52::numeric),
  ('Hertog Jan',3.58),
  ('Coors Light',2.84),
  ('Sapporo Premium',3.51),
  ('Kirin Ichiban',3.43),
  ('Modelo Especial',3.55),
  ('Stella Artois',3.3),
  ('Duvel',3.7),
  ('Carlsberg',3.09),
  ('Carlsberg Elephant',3.42),
  ('Harp Lager',3.42),
  ('La Fin Du Monde',4.07),
  ('Kronenbourg 1664',3.3),
  ('Michelob Ultra',2.84),
  ('Guinness Draught',3.8),
  ('Red Stripe',3.31),
  ('Heineken',3),
  ('Weihenstephaner Hefeweissbier',3.8),
  ('Negra Modelo',3.6),
  ('Hofbräu Münchner Weiße',3.8),
  ('Hofbräu Dunkel',3.55),
  ('Bud Light',2.3),
  ('Budweiser',2.6),
  ('Corona Extra',3.47),
  ('Dos Equis Lager Especial',3.25),
  ('Frisse Lentebok',3.25),
  ('Estrella Galicia',3.65),
  ('Pilsner Urquell',3.8),
  ('Wrench',3.95),
  ('Żywiec',3.35),
  ('Peroni Nastro Azzurro',3.56),
  ('Estrella Damm',3.61),
  ('Grolsch Puur Weizen',3.5),
  ('Leffe Blonde',3.75),
  ('Texels Skuumkoppe',3.65),
  ('Affligem Tripel',3.8),
  ('De Koninck',3.55),
  ('IJwit',3.5),
  ('La Chouffe Blonde',3.85),
  ('Stiegl Goldbräu',3.35),
  ('Modelo Oro',3.45),
  ('Super Bock',3.41),
  ('Estrella Jalisco',3.2),
  ('Rolling Rock Extra Pale',3.05),
  ('Birra Moretti',3.58),
  ('Erdinger Weißbier',3.78),
  ('Miller Lite',2.51),
  ('Pacífico Clara',3.65),
  ('Narragansett Lager',3.23),
  ('Big Wave Golden Ale',3.52),
  ('Belhaven Scottish Stout',3.45),
  ('Samuel Adams Summer Ale',3.5)
on conflict (beer_name) do nothing;

insert into public.app_meta (key,value) values
  ('untappd_last_refreshed'::text,'2026-05-05'::text),
  ('untappd_refresh_interval_days','14')
on conflict (key) do nothing;

-- ── Filling in what the old form could not ────────────────────
-- Until now this app's add-beer form could not set a beer's origin country,
-- its region or its consumption country code, and never created a brewery at
-- all. So a review logged here before today has holes in exactly the columns
-- the site cannot render without, and a brewery created by hand has no
-- language. Those are filled in from what the rest of the row already says.

-- A beer's origin is its brewery's country.
update public.beers b
   set origin_cc = br.cc
  from public.breweries br
 where b.origin_cc is null and b.brewery = br.name and br.cc is not null;

-- The region and country code of a place come from the place.
update public.beers b
   set region  = coalesce(b.region, l.region),
       cc      = coalesce(b.cc, l.cc),
       country = coalesce(b.country, l.country)
  from public.locations l
 where b.city = l.city and (b.region is null or b.cc is null or b.country is null);

-- A brewery with no language borrows the one most of the other breweries in
-- its country use — which, by this point in the migration, means the ones this
-- seed just wrote. Better a real answer taken from the data than a guess.
--
-- The most common, not the first: Belgium is both nl and fr here, and picking
-- alphabetically would make every Flemish brewery French. It is still only a
-- guess for a bilingual country, so each one it fills in is named below —
-- check them, because the language drives the passport and the brewing-language
-- chart on the site.
do $$
declare guessed text;
begin
  select string_agg(name, ', ') into guessed from public.breweries where lang is null;

  update public.breweries b
     set lang = m.lang
    from (
      select distinct on (cc) cc, lang
        from (
          select cc, lang, count(*) as n
            from public.breweries
           where lang is not null and cc is not null
           group by cc, lang
        ) t
       order by cc, n desc, lang
    ) m
   where b.lang is null and b.cc = m.cc;

  if guessed is not null then
    raise notice 'language guessed from the country for: % — check it', guessed;
  end if;
end $$;

-- ── What the site cannot render without ───────────────────────
-- Each of these is a rule `npm run check` already enforces in the static site.
-- Enforcing them here too moves the failure to the moment the bad row is
-- written, where the person writing it can still see what they meant, rather
-- than to a CI run days later against a review nobody remembers.
--
-- Applied one at a time, and only where the column is actually complete. A row
-- the backfill above could not reach must not take the whole migration down
-- with it — the log is more important than the constraint, and `npm run check`
-- still names anything left incomplete.
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
    else
      raise notice
        '%.% left nullable: % row(s) still empty. Fill them in, then: alter table public.% alter column % set not null;',
        t, c, n, t, c;
    end if;
  end loop;
end $$;

-- A rating is out of five, in quarter steps: 3.6 is not a rating this log can
-- express, and it would sort and average as though it were.
alter table public.beers drop constraint if exists beers_rating_quarters;
alter table public.beers add constraint beers_rating_quarters
  check (rating >= 0 and rating <= 5 and (rating * 4) = round(rating * 4));

alter table public.beers drop constraint if exists beers_method_known;
alter table public.beers add constraint beers_method_known
  check (method in ('Bottle', 'Can', 'Draft', 'Nitro'));

-- A brand domain is a bare domain — no scheme, no path. The logo chain builds
-- the URL itself, so a stored "https://…/logo.png" resolves to nothing.
--
-- A check constraint may not contain a subquery, so the test over the array
-- lives in a function it can call.
create or replace function public.is_bare_domain_list(domains text[])
returns boolean language sql immutable as $fn$
  select coalesce(array_length(domains, 1), 0) >= 1
     and not exists (
       select 1 from unnest(domains) as d
       where d is null or d !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
     );
$fn$;

alter table public.brand_domains drop constraint if exists brand_domains_bare;
alter table public.brand_domains add constraint brand_domains_bare
  check (public.is_bare_domain_list(domains));
