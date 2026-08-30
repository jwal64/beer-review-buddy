// Brand domains used to fetch real brewery logos.
const BEER_DOMAINS: Record<string, string> = {
  "1664": "kronenbourg1664.com",
  "Affligem Tripel": "affligembeer.com",
  "Bolleke De Koninck": "dekoninck.be",
  "Bud Light": "budlight.com",
  Budweiser: "budweiser.com",
  Carlsberg: "carlsberg.com",
  "Coors Light": "coorslight.com",
  "Corona Extra": "coronausa.com",
  Duvel: "duvel.com",
  "Erdinger Weissbier": "erdinger.de",
  "Estrella Damm": "estrelladamm.com",
  "Estrella Galicia": "estrellagalicia.es",
  Grolsch: "grolsch.com",
  "Grolsch Puur Weizen": "grolsch.com",
  Guinness: "guinness.com",
  Harp: "harp.ie",
  Heineken: "heineken.com",
  "Hertog Jan": "hertogjan.nl",
  IJwit: "brouwerijhetij.nl",
  Ichiban: "kirin.co.jp",
  "La Chouffe Blonde": "achouffe.be",
  "La Fin Du Monde": "unibroue.com",
  "Leffe Blonde": "leffe.com",
  "Michelob Ultra": "michelobultra.com",
  Modelo: "modelousa.com",
  "Modelo Negra": "modelousa.com",
  Moretti: "birramoretti.com",
  "Munchen Dunkel": "weihenstephaner.de",
  "Münchner Weisse": "hofbraeu-muenchen.de",
  Peroni: "peroniitaly.com",
  "Pilsner Urquell": "pilsnerurquell.com",
  "Red Stripe": "redstripebeer.com",
  Sapporo: "sapporobeer.com",
  "Stella Artois": "stellaartois.com",
  "Stiegl Goldbräu": "stiegl.at",
  "Texels Skuumkoppe": "texelsebierbrouwerij.nl",
  Weihenstephaner: "weihenstephaner.de",
  Wrench: "industrialartsbrewing.com",
  Żywiec: "zywiec.com.pl",
};

const BREWERY_DOMAINS: Record<string, string> = {
  Weihenstephaner: "weihenstephaner.de",
  "Guinness (St. James's Gate)": "guinness.com",
  "Harp / Diageo": "harp.ie",
  "Duvel Moortgat": "duvel.com",
  "AB InBev (Stella)": "stellaartois.com",
  Heineken: "heineken.com",
  Grolsch: "grolsch.com",
  "Bavaria NV (Hertog Jan)": "hertogjan.nl",
  "Anheuser-Busch": "anheuser-busch.com",
  "Molson Coors": "molsoncoors.com",
  "Grupo Modelo": "modelousa.com",
  Carlsberg: "carlsberg.com",
  Unibroue: "unibroue.com",
  Kronenbourg: "kronenbourg1664.com",
  "Sapporo Brewery": "sapporobeer.com",
  "Kirin Brewery": "kirin.co.jp",
  "Red Stripe (D&G)": "redstripebeer.com",
  "Estrella Galicia": "estrellagalicia.es",
  "Pilsner Urquell": "pilsnerurquell.com",
  "Birra Moretti (Heineken Italia)": "birramoretti.com",
  "Erdinger Weissbräu": "erdinger.de",
  "Industrial Arts Brewing": "industrialartsbrewing.com",
  "Żywiec Brewery (Grupa Żywiec)": "zywiec.com.pl",
  "Birra Peroni": "peroniitaly.com",
  "S.A. Damm": "estrelladamm.com",
  "Abbaye de Leffe (AB InBev)": "leffe.com",
  "Texelse Bierbrouwerij": "texelsebierbrouwerij.nl",
  "Affligem Brewery (Heineken)": "affligembeer.com",
  "De Koninck Brewery": "dekoninck.be",
  "Brouwerij 't IJ": "brouwerijhetij.nl",
  "Brasserie d'Achouffe": "achouffe.be",
  "Stieglbrauerei zu Salzburg": "stiegl.at",
};

function favicon(domain: string, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export function beerLogo(beerName: string, brewery?: string | null) {
  const domain =
    BEER_DOMAINS[beerName] ??
    (brewery ? (BREWERY_DOMAINS[brewery] ?? BEER_DOMAINS[brewery]) : undefined);
  return domain ? favicon(domain) : null;
}

export function breweryLogo(name: string) {
  const domain = BREWERY_DOMAINS[name];
  return domain ? favicon(domain) : null;
}
