// A beer's fun facts — what its card in the beers list says about it.
//
// Every fact is worked out from the log: the beer's own BEER_FACTS entry, its
// brewery row, where it was drunk, the world's Untappd average, and how it sits
// among every other review. Nothing is written by hand and nothing is guessed,
// so a fact appears only when the data behind it does — a beer with no
// published IBU simply has no IBU fact.
//
// Imports nothing at runtime (the types are erased), so
// tools/app-logic-test.mjs can load it in plain Node.
import type { Beer, BeerFactsRow, BreweryRow, LocationRow } from "./snapshot.ts";

export interface FunFactContext {
  /** Every review in the log. */
  beers: Beer[];
  brewery?: BreweryRow | undefined;
  facts?: BeerFactsRow | undefined;
  /** Where this review was drunk. */
  location?: LocationRow | undefined;
  /** The world's Untappd average for this beer. */
  world?: number | undefined;
}

export interface FunFact {
  emoji: string;
  text: string;
}

const KM_PER_MI = 1.609344;

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const ordinal = (k: number) => {
  const s = k % 100 >= 11 && k % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][k % 10] ?? "th");
  return `${k}${s}`;
};
const article = (word: string) => (/^[aeiou]/i.test(word) ? "An" : "A");
const list = (items: string[]) =>
  items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** Where `value` sits among `values`: 1 is the highest; ties share a place. */
function placeOf(value: number, values: number[]) {
  return 1 + values.filter((v) => v > value).length;
}

/** The share of `values` strictly below `value`, as a whole percentage. */
function shareBelow(value: number, values: number[]) {
  return Math.round((100 * values.filter((v) => v < value).length) / values.length);
}

export function funFacts(beer: Beer, ctx: FunFactContext): FunFact[] {
  const out: FunFact[] = [];
  const { beers, brewery, facts, location, world } = ctx;
  const rating = Number(beer.rating);

  // What it is.
  if (facts?.sub) {
    const look = [
      facts.color && `${facts.color.toLowerCase()} in colour`,
      facts.body && `${facts.body.toLowerCase()} in body`,
    ].filter(Boolean) as string[];
    out.push({
      emoji: "🍺",
      text: `${article(facts.sub)} ${facts.sub}${look.length ? ` — ${list(look)}` : ""}.`,
    });
  }
  if (brewery?.native_name && brewery.native_name !== beer.name) {
    out.push({ emoji: "🗣️", text: `Known at home as ${brewery.native_name}.` });
  }
  if (facts?.adjuncts.length) {
    out.push({ emoji: "🌾", text: `Brewed with ${list(facts.adjuncts)}.` });
  }

  // How far it came.
  if (brewery && location) {
    const km = distanceKm(brewery, location);
    out.push(
      km < 50
        ? { emoji: "🏠", text: `Drunk within 50 km of the brewery in ${brewery.location}.` }
        : {
            emoji: "✈️",
            text: `Travelled about ${n(km)} km (${n(km / KM_PER_MI)} mi) from ${brewery.location} to the glass in ${location.city}.`,
          },
    );
  }

  // Against the world.
  if (world != null) {
    const diff = rating - world;
    out.push({
      emoji: "🌍",
      text:
        Math.abs(diff) < 0.05
          ? `Right on the world's Untappd average of ${world.toFixed(2)}.`
          : `Rated ${Math.abs(diff).toFixed(2)} ${diff > 0 ? "above" : "below"} the world's Untappd average of ${world.toFixed(2)}.`,
    });
  }

  // Against the rest of the log.
  const ratings = beers.map((b) => Number(b.rating));
  const place = placeOf(rating, ratings);
  const tied = ratings.filter((r) => r === rating).length > 1;
  out.push({
    emoji: "🏆",
    text: `${tied ? "Joint " : ""}${ordinal(place)} of ${beers.length} reviews by rating.`,
  });

  const sameStyle = beers.filter((b) => b.style === beer.style);
  if (sameStyle.length === 1) {
    out.push({ emoji: "🦄", text: `The only ${beer.style} in the log.` });
  } else {
    const styleRatings = sameStyle.map((b) => Number(b.rating));
    if (placeOf(rating, styleRatings) === 1) {
      const joint = styleRatings.filter((r) => r === rating).length > 1;
      out.push({
        emoji: "🥇",
        text: `${joint ? "Joint top-rated" : "The top-rated"} ${beer.style}, out of ${sameStyle.length} reviews.`,
      });
    }
  }

  const abvs = beers.filter((b) => b.abv != null).map((b) => Number(b.abv));
  if (beer.abv != null && abvs.length > 1) {
    const abv = Number(beer.abv);
    if (abv === Math.max(...abvs))
      out.push({ emoji: "💪", text: `The strongest beer in the log, at ${abv}%.` });
    else if (abv === Math.min(...abvs))
      out.push({ emoji: "🪶", text: `The lightest beer in the log, at ${abv}%.` });
    else
      out.push({
        emoji: "💪",
        text: `Stronger than ${shareBelow(abv, abvs)}% of the beers in the log.`,
      });
  }

  if (facts?.ibu != null) {
    out.push({ emoji: "🌿", text: `${facts.ibu} IBU of bitterness, as the brewery publishes it.` });
  }
  if (facts?.cal != null) {
    out.push({ emoji: "🔥", text: `${facts.cal} calories in 12 fl oz.` });
  }

  // How often, and who else.
  const pours = beers.filter((b) => b.name === beer.name);
  if (pours.length > 1) {
    const avg = pours.reduce((s, b) => s + Number(b.rating), 0) / pours.length;
    out.push({
      emoji: "🔁",
      text: `Poured ${pours.length} times, averaging ${avg.toFixed(2)}.`,
    });
  }
  if (beer.brewery) {
    const siblings = new Set(
      beers.filter((b) => b.brewery === beer.brewery && b.name !== beer.name).map((b) => b.name),
    );
    if (siblings.size) {
      const names = [...siblings].sort();
      const shown = names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} more`] : names;
      out.push({ emoji: "🏭", text: `${beer.brewery} also makes ${list(shown)} in the log.` });
    }
  }

  return out;
}
