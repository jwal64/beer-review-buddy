# Roadmap

Where the project stands and what comes next. History lives in `git log`;
the standing rules live in CLAUDE.md and AGENTS.md.

## Now

- One committed log, `public/stats/data.js`, projected into
  `src/data/snapshot.json` for the app. No database.
- One surface: the React app (Home, Beers, Map, Insights). `/stats`
  redirects to Insights.
- A beer is added by a Claude session following `/add-beer`, as a pull
  request; merging syncs it into Lovable, **Publish** makes it live.
- Every logo is a committed file under `public/stats/logos/`.

## Next

- [x] **Cleanup** — delete the `supabase/` remains, the unused generated
      client in `src/integrations/supabase/` and the `@supabase/supabase-js`
      dependency; rewrite this file.
- [x] **Delete the static site** — `public/stats/` is down to the log and the
      logos, and `/stats` redirects to `/insights`. The logic tests pin the
      app's own `src/lib/`. The SRI tool and the browser logo audit are gone,
      and the smoke test drives the app (and proves the map popup stays open).
- [ ] **The log becomes `src/data/log.ts`** — a typed module the app imports
      directly. The projection moves into `src/lib/rows.ts`; `snapshot.json`
      and the round-trip tooling go. Logos move to `public/logos/`, and
      `public/stats/` goes.
- [ ] **Passport & gamification** — a `/passport` tab with badges, country
      and continent stamps, monthly streaks and yearly goals (a `GOALS`
      entry in the log), a style-bingo card, and "next stamp" picks from the
      shortlist. Logic in `src/lib/progress.ts`, tested in plain Node.

## Later

- [ ] **Issue → pull request, automatically.** A workflow on
      `issues: labeled beer` runs `anthropics/claude-code-action`, follows
      `.claude/skills/add-beer/SKILL.md` and opens a PR with `Closes #N`.
      Blocked on an `ANTHROPIC_API_KEY` repo secret (or the Claude GitHub
      App via `@claude`). That needs a conversation first, per CLAUDE.md.
- [ ] Archive `jwal64/JWAL-BEER-REVIEW` and turn off its GitHub Pages
      (owner action).
- [ ] Replace the drawn-approximation logos with the brands' official
      artwork where one is publicly available.
