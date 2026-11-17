// Les tendances du jour, pour l'IA qui gère le site (fichier privé, déposé par root après la collecte) :
// recherches qui montent ou baissent (Keyword Planner) et ce que Google fait de nos pages (Search Console).
// Calculées depuis la base seulement ; ces données ne sont pas publiées sur le site.
import type { SiteReader } from "../contract.js";
import { buildKeywordsPage } from "./keywords-page.js";
import { PERIOD_KEY, SEARCH_CONSOLE_SNAPSHOT, type SearchPeriod, type SearchRow } from "../plugins/search-console/index.js";

/** Ce que Google fait de nos pages : les recherches qui comptent, les occasions (position 4 à 20, déjà vues),
 *  les pages vues mais peu cliquées. Null tant que le plugin n'a rien relevé. */
export const OPPORTUNITY = { minImpressions: 20, fromPosition: 4, toPosition: 20 } as const;
function searchConsole(read: SiteReader) {
  const date = read.snapshotDates(SEARCH_CONSOLE_SNAPSHOT).at(-1);
  if (!date) return null;
  const items = read.snapshot(SEARCH_CONSOLE_SNAPSHOT, date);
  const period = items.find((i) => i.key === PERIOD_KEY)?.value as SearchPeriod | undefined;
  const rows = items.filter((i) => i.key !== PERIOD_KEY).map((i) => i.value as SearchRow);
  const byPage = new Map<string, { page: string; impressions: number; clicks: number }>();
  for (const r of rows) {
    const p = byPage.get(r.page) ?? byPage.set(r.page, { page: r.page, impressions: 0, clicks: 0 }).get(r.page)!;
    p.impressions += r.impressions; p.clicks += r.clicks;
  }
  return {
    period: period ?? null,
    totals: { impressions: rows.reduce((s, r) => s + r.impressions, 0), clicks: rows.reduce((s, r) => s + r.clicks, 0), queries: rows.length },
    topQueries: [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, TOP),
    opportunities: rows.filter((r) => r.impressions >= OPPORTUNITY.minImpressions && r.position >= OPPORTUNITY.fromPosition && r.position <= OPPORTUNITY.toPosition)
      .sort((a, b) => b.impressions - a.impressions).slice(0, TOP),
    seenNotClicked: [...byPage.values()].filter((p) => p.impressions >= OPPORTUNITY.minImpressions && p.clicks === 0).sort((a, b) => b.impressions - a.impressions).slice(0, TOP),
  };
}

/** Une recherche ne compte comme tendance qu'au-delà de ce volume mensuel (en dessous, le bruit domine). */
export const MIN_TREND_VOLUME = 500;
const TOP = 25;

export function buildTrends(read: SiteReader, today: string) {
  const kw = buildKeywordsPage(read, today);
  const ideas = kw ? kw.groups.flatMap((g) => g.ideas.map((i) => ({ page: g.page, group: g.label, text: i.text, volume: i.volume, trend: i.trend }))) : [];
  const withTrend = ideas.filter((i) => i.trend !== null && i.volume >= MIN_TREND_VOLUME);
  return {
    generatedAt: today,
    keywordsDate: kw?.date ?? null, keywordsStale: kw?.stale ?? null,
    searches: {
      rising: [...withTrend].sort((a, b) => b.trend! - a.trend!).slice(0, TOP),
      falling: [...withTrend].sort((a, b) => a.trend! - b.trend!).slice(0, 10),
      biggest: [...ideas].sort((a, b) => b.volume - a.volume).slice(0, TOP),
    },
    searchConsole: searchConsole(read),
  };
}
