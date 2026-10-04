import { useMemo } from "react";
import {
  averageRating,
  useBeerFacts,
  useBeers,
  useBreweries,
  useGoals,
  useUntappdAverages,
  useWantToTry,
} from "@/lib/beer-data";
import { beerRating, groupRatings, scoreShortlist } from "@/lib/insights";
import {
  badges,
  bingoLines,
  goals,
  nextStamps,
  passport,
  sortBadges,
  streak,
  styleBingo,
} from "@/lib/progress";

/**
 * Everything the Passport tab shows, worked out from the log in one pass. The
 * Home page's progress strip reads the same object, so the two can never
 * disagree about a streak or a badge.
 */
export function useProgress() {
  const beersQ = useBeers();
  const { data: breweries } = useBreweries();
  const { data: facts } = useBeerFacts();
  const { data: world } = useUntappdAverages();
  const { data: shortlist } = useWantToTry();
  const { data: goalRows } = useGoals();

  const data = useMemo(() => {
    const list = beersQ.data ?? [];
    const factMap = facts ?? new Map();
    const ctx = {
      breweries: breweries ?? [],
      facts: factMap,
      world: world ?? new Map<string, number>(),
      shortlist: shortlist ?? [],
    };

    // The shortlist's guesses, built exactly as Insights builds them.
    const styleMap = new Map(
      groupRatings(list, (b) => b.style, beerRating).map((g) => [g.label, g]),
    );
    const originMap = new Map(
      groupRatings(list, (b) => b.origin_cc, beerRating).map((g) => [g.label, g]),
    );
    const scored = scoreShortlist(shortlist ?? [], list, averageRating(list), styleMap, originMap);

    const badgeList = sortBadges(badges(list, ctx));
    const pass = passport(list);
    const bingo = styleBingo(list, factMap, scored);
    const now = new Date();
    return {
      badges: badgeList,
      earned: badgeList.filter((b) => b.earned).length,
      latestBadge: badgeList.find((b) => b.earned && b.earnedOn !== "retro") ?? null,
      passport: pass,
      next: nextStamps(scored, pass.brewed),
      streak: streak(list, now),
      goals: goals(list, goalRows ?? [], now),
      thisYear: now.getFullYear(),
      bingo,
      bingoLines: bingoLines(bingo),
    };
  }, [beersQ.data, breweries, facts, world, shortlist, goalRows]);

  return {
    data,
    isLoading: beersQ.isLoading,
    isError: beersQ.isError,
    refetch: beersQ.refetch,
  };
}
