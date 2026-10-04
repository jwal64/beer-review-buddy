---
name: add-beer
description: Log a new beer review. Use whenever the owner gives a new beer entry — an Untappd screenshot, or a beer name with brewery, where it was drunk, rating and serving method — or a GitHub issue labelled `beer`.
argument-hint: "[beer, brewery, where consumed, rating, serving method — or attach a screenshot]"
---

# Add a beer

Read `CLAUDE.md` and follow **Standard Operating Procedure: Adding a Beer**.
The rules below are mandatory on top of it.

The new beer to log: $ARGUMENTS
(If it arrived as a screenshot or an issue, read the beer name, brewery, where
it was consumed, rating and serving method from that. Ask only for what cannot
be read or researched — e.g. `isNew` when unsure.)

## 1. Start from the latest `main`

```sh
git fetch origin main && git checkout -B main origin/main   # or: git pull origin main
```

## 2. The data steps, all in `src/data/log.ts`

1. **`beers[]`** — append under the current month's comment header; rating in
   0.25 steps.
2. **`breweries[]`** — add or update. Coordinates are the **brewery's own
   site, never the city centre**. UK breweries use the constituent code
   (`GB-ENG`, `GB-SCT`, `GB-WLS`, `GB-NIR`). Record `nativeName` when it differs.
   Keep `beers` and `ratings` paired, same order.
3. **`BRAND_DOMAINS`** — the brand's own domain(s), never a parent company's.
4. **Logo** — `npm run fetch-logos`, then `npm run logo-sheet` and look at it.
   If nothing is reachable, place the file under `public/logos/` by hand,
   add it to `BRAND_LOGOS`, **and list it under `kept` in
   `logo-fetch-report.json`**.
5. **`BEER_FACTS`** — published IBU / calories or `null`. Never guess or borrow.
6. **`drunkLocs[]`** — make sure the consumption city exists, exactly matching
   the review's city/region/country/cc.
7. **A new country** (brewing or drinking) needs `FLAGS`, `CNAMES` and a row
   in `CONTINENTS` in `src/data/continents.ts`.

## 3. Validate

```sh
npm run check && npx tsc --noEmit
```

Both must pass. There is nothing to regenerate: the app imports the log.

## 4. Keep the invariants intact

Do not touch `src/lib/place.ts`, `src/lib/snapshot.ts`, `src/lib/rows.ts`, or the module-scope
`selectBrandDomains` / `selectBrandLogos` in `src/lib/beer-data.ts`.

## 5. Commit, push a branch, open a pull request

- Work on a branch cut from the latest `main` (e.g. `claude/add-<beer-slug>`),
  never directly on `main`.
- Commit `src/data/log.ts` (plus any logo files under `public/logos/` and
  `logo-fetch-report.json`) **together, in one commit**. If the beer
  came from an issue, add `Closes #N`.
- Push with `git push -u origin <branch>` and **open a pull request into
  `main`** (check for a PR template first). Do not merge it: the owner reviews
  and merges.
- **Never rebase, squash, amend or force-push.** If main moved, merge it in.

## 6. Tell the owner

Link the PR, and end the reply with: **Once you merge it, click Publish →
Publish changes in Lovable** (the live site does not change until they do).
