create table public.locations (
  id uuid primary key default gen_random_uuid(),
  city text not null, region text, country text not null, cc text,
  lat double precision, lng double precision,
  created_at timestamptz not null default now(),
  unique (city, country)
);
create table public.breweries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, location text, country text, cc text,
  lat double precision, lng double precision, logo_url text,
  created_at timestamptz not null default now()
);
create table public.beers (
  id uuid primary key default gen_random_uuid(),
  name text not null, brewery text, style text not null, origin_cc text,
  abv numeric(4,1), method text, city text, region text, country text, cc text,
  rating numeric(3,2) not null, is_new boolean not null default false,
  drank_on date not null default current_date, logo_url text, notes text,
  created_by uuid, created_at timestamptz not null default now()
);

grant select on public.locations to anon;
grant select, insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;
grant select on public.breweries to anon;
grant select, insert, update, delete on public.breweries to authenticated;
grant all on public.breweries to service_role;
grant select on public.beers to anon;
grant select, insert, update, delete on public.beers to authenticated;
grant all on public.beers to service_role;

alter table public.locations enable row level security;
alter table public.breweries enable row level security;
alter table public.beers enable row level security;

create policy "locations are public" on public.locations for select using (true);
create policy "locations writable by signed in" on public.locations for all to authenticated using (true) with check (true);
create policy "breweries are public" on public.breweries for select using (true);
create policy "breweries writable by signed in" on public.breweries for all to authenticated using (true) with check (true);
create policy "beers are public" on public.beers for select using (true);
create policy "beers writable by signed in" on public.beers for all to authenticated using (true) with check (true);

create index beers_drank_on_idx on public.beers (drank_on desc);
create index beers_name_idx on public.beers (name);

insert into public.locations (city, region, country, cc, lat, lng) values
('New York','New York','USA','US',40.7128,-74.0060),
('New Rochelle','New York','USA','US',40.9115,-73.7826),
('White Plains','New York','USA','US',41.0340,-73.7629),
('Eastchester','New York','USA','US',40.9565,-73.8115),
('Hartsdale','New York','USA','US',41.0215,-73.7987),
('Montreal','Quebec','Canada','CA',45.5017,-73.5673),
('Amsterdam','Noord-Holland','Netherlands','NL',52.3676,4.9041),
('Hengelo','Overijssel','Netherlands','NL',52.2660,6.7930),
('Uncassville','Connecticut','USA','US',41.4775,-72.0892),
('Queens','New York','USA','US',40.7282,-73.7949),
('Oldenzaal','Overijssel','Netherlands','NL',52.3107,6.9280),
('Nijmegen','Gelderland','Netherlands','NL',51.8426,5.8528),
('Antwerp','Antwerp','Belgium','BE',51.2194,4.4025),
('Clemson','South Carolina','USA','US',34.6834,-82.8374),
('East Rutherford','New Jersey','USA','US',40.8136,-74.0745);

insert into public.breweries (name, location, country, cc, lat, lng) values
('Weihenstephaner','Freising, Bavaria','Germany','DE',48.3953,11.7291),
('Guinness (St. James''s Gate)','Dublin, Leinster','Ireland','IE',53.3418,-6.2868),
('Harp / Diageo','Dundalk, County Louth','Ireland','IE',54.0039,-6.3703),
('Duvel Moortgat','Puurs-Sint-Amands, Antwerp','Belgium','BE',51.0727,4.2897),
('AB InBev (Stella)','Leuven, Flemish Brabant','Belgium','BE',50.8798,4.7005),
('Heineken','Amsterdam, Noord-Holland','Netherlands','NL',52.3578,4.8918),
('Grolsch','Enschede, Overijssel','Netherlands','NL',52.2215,6.8937),
('Bavaria NV (Hertog Jan)','Arcen, Limburg','Netherlands','NL',51.4862,6.1741),
('Anheuser-Busch','St. Louis, Missouri','USA','US',38.6072,-90.2124),
('Molson Coors','Golden, Colorado','USA','US',39.7555,-105.2211),
('Grupo Modelo','Mexico City, CDMX','Mexico','MX',19.4274,-99.1677),
('Carlsberg','Copenhagen, Capital Region','Denmark','DK',55.6614,12.5361),
('Unibroue','Chambly, Quebec','Canada','CA',45.4412,-73.2615),
('Kronenbourg','Obernai, Alsace','France','FR',48.4637,7.4845),
('Sapporo Brewery','Sapporo, Hokkaido','Japan','JP',43.0685,141.3544),
('Kirin Brewery','Yokohama, Kanagawa','Japan','JP',35.4634,139.6220),
('Red Stripe (D&G)','Kingston, Surrey','Jamaica','JM',17.9972,-76.7939),
('Estrella Galicia','A Coruña, Galicia','Spain','ES',43.3623,-8.4115),
('Pilsner Urquell','Pilsen, Bohemia','Czech Republic','CZ',49.7479,13.3756),
('Birra Moretti (Heineken Italia)','Udine, Friuli-Venezia Giulia','Italy','IT',46.0640,13.2350),
('Erdinger Weissbräu','Erding, Bavaria','Germany','DE',48.3063,11.9071),
('Industrial Arts Brewing','Beacon, New York','USA','US',41.5048,-73.9690),
('Żywiec Brewery (Grupa Żywiec)','Żywiec, Silesia','Poland','PL',49.6853,19.1925),
('Birra Peroni','Rome, Lazio','Italy','IT',41.8902,12.4922),
('S.A. Damm','Barcelona, Catalonia','Spain','ES',41.3897,2.1540),
('Abbaye de Leffe (AB InBev)','Dinant, Namur','Belgium','BE',50.2611,4.9122),
('Texelse Bierbrouwerij','Oudeschild, North Holland','Netherlands','NL',53.0385,4.8510),
('Affligem Brewery (Heineken)','Opwijk, Flemish Brabant','Belgium','BE',50.9786,4.1868),
('De Koninck Brewery','Antwerp, Antwerp','Belgium','BE',51.2157,4.4156),
('Brouwerij ''t IJ','Amsterdam, Noord-Holland','Netherlands','NL',52.3657,4.9196),
('Brasserie d''Achouffe','Achouffe, Luxembourg','Belgium','BE',50.1283,5.7981),
('Stieglbrauerei zu Salzburg','Salzburg, Salzburg','Austria','AT',47.8095,13.0550);

insert into public.beers (name, brewery, style, origin_cc, abv, method, city, region, country, cc, rating, is_new, drank_on) values
('Grolsch','Grolsch','Pilsner','NL',5.0,'Bottle','Hengelo','Overijssel','Netherlands','NL',3.50,false,'2026-01-01'),
('Hertog Jan','Hertog Jan','Pilsner','NL',5.1,'Bottle','Hengelo','Overijssel','Netherlands','NL',2.00,false,'2026-01-01'),
('Coors Light','Coors','Lager','US',4.2,'Can','New Rochelle','New York','USA','US',3.00,false,'2026-01-01'),
('Sapporo','Sapporo','Lager','JP',4.9,'Bottle','Hartsdale','New York','USA','US',3.50,false,'2026-01-01'),
('Ichiban','Kirin','Lager','JP',5.0,'Bottle','Hartsdale','New York','USA','US',3.00,false,'2026-01-01'),
('Modelo','Grupo Modelo','Lager','MX',4.5,'Bottle','White Plains','New York','USA','US',3.25,false,'2026-01-01'),
('Stella Artois','Stella Artois','Lager','BE',5.0,'Bottle','Eastchester','New York','USA','US',2.75,false,'2026-01-01'),
('Duvel','Duvel Moortgat','Belgian Ale','BE',8.5,'Bottle','White Plains','New York','USA','US',4.00,false,'2026-01-01'),
('Duvel','Duvel Moortgat','Belgian Ale','BE',8.5,'Bottle','Amsterdam','Noord-Holland','Netherlands','NL',4.25,false,'2026-01-01'),
('Carlsberg','Carlsberg','Pilsner','DK',5.0,'Can','New Rochelle','New York','USA','US',2.75,false,'2026-01-01'),
('Carlsberg','Carlsberg','Pilsner','DK',5.0,'Draft','Montreal','Quebec','Canada','CA',3.00,false,'2026-01-01'),
('Harp','Harp','Lager','IE',4.5,'Draft','Montreal','Quebec','Canada','CA',4.25,false,'2026-01-01'),
('La Fin Du Monde','Unibroue','Belgian Ale','CA',9.0,'Can','Montreal','Quebec','Canada','CA',2.75,false,'2026-01-01'),
('1664','Kronenbourg','Lager','FR',5.5,'Draft','Montreal','Quebec','Canada','CA',3.00,false,'2026-01-01'),
('Michelob Ultra','Michelob','Lager','US',4.2,'Can','White Plains','New York','USA','US',2.50,false,'2026-01-01'),
('Guinness','Guinness','Stout','IE',4.2,'Nitro','New York','New York','USA','US',3.25,false,'2026-01-01'),
('Red Stripe','Red Stripe','Lager','JM',4.7,'Bottle','Clemson','South Carolina','USA','US',3.75,false,'2026-01-01'),
('Heineken','Heineken','Lager','NL',5.0,'Draft','New York','New York','USA','US',3.25,false,'2026-02-01'),
('Guinness','Guinness','Stout','IE',4.2,'Nitro','Eastchester','New York','USA','US',4.00,false,'2026-02-01'),
('Weihenstephaner','Weihenstephaner','Wheat Beer','DE',5.4,'Bottle','New Rochelle','New York','USA','US',4.50,false,'2026-02-01'),
('Modelo Negra','Grupo Modelo','Lager','MX',5.4,'Bottle','New Rochelle','New York','USA','US',2.25,false,'2026-02-01'),
('Münchner Weisse','Hofbräu München','Wheat Beer','DE',5.1,'Draft','New York','New York','USA','US',4.75,false,'2026-02-01'),
('Modelo Negra','Grupo Modelo','Lager','MX',5.4,'Bottle','New Rochelle','New York','USA','US',3.00,false,'2026-02-01'),
('Stella Artois','Stella Artois','Lager','BE',5.0,'Bottle','New Rochelle','New York','USA','US',2.75,false,'2026-02-01'),
('Munchen Dunkel','Weihenstephaner','Lager','DE',5.5,'Draft','New York','New York','USA','US',2.75,false,'2026-02-01'),
('Bud Light','Anheuser-Busch','Lager','US',4.2,'Bottle','East Rutherford','New Jersey','USA','US',3.00,true,'2026-02-01'),
('Budweiser','Anheuser-Busch','Lager','US',5.0,'Bottle','New York','New York','USA','US',3.00,true,'2026-02-01'),
('Corona Extra','Grupo Modelo','Lager','MX',4.5,'Bottle','New Rochelle','New York','USA','US',3.00,true,'2026-02-01'),
('Corona Extra','Grupo Modelo','Lager','MX',4.5,'Bottle','New Rochelle','New York','USA','US',3.75,false,'2026-02-01'),
('Heineken','Heineken','Lager','NL',5.0,'Bottle','Uncassville','Connecticut','USA','US',3.25,false,'2026-02-01'),
('Moretti','Birra Moretti','Lager','IT',4.6,'Bottle','New Rochelle','New York','USA','US',3.75,true,'2026-02-01'),
('Erdinger Weissbier','Erdinger','Wheat Beer','DE',5.3,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-02-01'),
('Sapporo','Sapporo','Lager','JP',4.9,'Bottle','Eastchester','New York','USA','US',3.00,false,'2026-02-01'),
('Coors Light','Coors','Lager','US',4.2,'Bottle','Eastchester','New York','USA','US',2.75,false,'2026-02-01'),
('Estrella Galicia','Hijos de Rivera','Lager','ES',5.5,'Bottle','New Rochelle','New York','USA','US',4.25,true,'2026-03-01'),
('Pilsner Urquell','Pilsner Urquell','Pilsner','CZ',4.4,'Bottle','New Rochelle','New York','USA','US',3.25,true,'2026-03-01'),
('Wrench','Industrial Arts','IPA','US',7.1,'Can','New Rochelle','New York','USA','US',4.00,true,'2026-03-01'),
('La Fin Du Monde','Unibroue','Belgian Ale','CA',9.0,'Bottle','New Rochelle','New York','USA','US',3.75,false,'2026-03-01'),
('Żywiec','Żywiec','Lager','PL',5.5,'Bottle','New Rochelle','New York','USA','US',2.75,true,'2026-03-01'),
('Corona Extra','Grupo Modelo','Lager','MX',4.5,'Bottle','New York','New York','USA','US',3.50,false,'2026-03-01'),
('Peroni','Birra Peroni','Lager','IT',5.1,'Bottle','New York','New York','USA','US',2.50,true,'2026-03-01'),
('Estrella Damm','Damm','Lager','ES',5.4,'Bottle','New Rochelle','New York','USA','US',3.50,true,'2026-03-01'),
('Heineken','Heineken','Lager','NL',5.0,'Draft','Queens','New York','USA','US',3.25,false,'2026-03-01'),
('Grolsch Puur Weizen','Grolsch','Wheat Beer','NL',5.1,'Draft','Oldenzaal','Overijssel','Netherlands','NL',5.00,true,'2026-03-01'),
('Leffe Blonde','Leffe','Belgian Ale','BE',6.6,'Draft','Nijmegen','Gelderland','Netherlands','NL',4.75,false,'2026-03-01'),
('Texels Skuumkoppe','Texelse Bierbrouwerij','Wheat Beer','NL',6.0,'Bottle','Nijmegen','Gelderland','Netherlands','NL',3.00,true,'2026-03-01'),
('Guinness','Guinness','Stout','IE',4.2,'Nitro','Nijmegen','Gelderland','Netherlands','NL',3.75,false,'2026-03-01'),
('Affligem Tripel','Affligem','Belgian Ale','BE',9.0,'Draft','Antwerp','Antwerp','Belgium','BE',3.75,true,'2026-03-01'),
('Bolleke De Koninck','De Koninck','Pale Ale','BE',5.2,'Draft','Antwerp','Antwerp','Belgium','BE',2.75,true,'2026-03-01'),
('IJwit','Brouwerij ''t IJ','Wheat Beer','NL',6.5,'Draft','Antwerp','Antwerp','Belgium','BE',3.75,true,'2026-03-01'),
('La Chouffe Blonde','Achouffe','Belgian Ale','BE',8.0,'Bottle','New Rochelle','New York','USA','US',4.25,true,'2026-03-01'),
('Stiegl Goldbräu','Stiegl','Lager','AT',5.0,'Bottle','New Rochelle','New York','USA','US',2.75,true,'2026-03-01');