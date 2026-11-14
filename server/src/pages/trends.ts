// Les tendances du jour, pour l'IA qui gère le site (fichier privé, déposé par root après la collecte) :
// recherches qui montent ou baissent, mouvements de prix, records, dernier changement de tarif. Calculées
// depuis la base seulement ; les données Keyword Planner ne sont pas publiées sur le site.
import type { Observation, SiteReader } from "../contract.js";
import { addDays } from "../units.js";
import { buildKeywordsPage } from "./keywords-page.js";
import { AREA_FRANCE, STATIONS_CATALOG_SETTING, stationSeriesId } from "../plugins/stations/index.js";
import { OIL_SERIES } from "../plugins/fuel/series-ids.js";
import { ELEC_CATALOG_SETTING, TRV_PART, trvSeriesId, wholesaleSeriesId } from "../plugins/electricity/series-ids.js";
import { parseElecCatalog } from "../plugins/electricity/decl.js";
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

export type Move = { what: string; latest: { date: string; value: number }; before: { date: string; value: number } | null; change: number | null;
  /** au plus haut ou au plus bas des 365 derniers jours */
  record: "haut" | "bas" | null };

/** Dernière valeur, celle d'environ `days` jours plus tôt, et si la dernière est un record sur un an. */
export function move(what: string, obs: Observation[], days: number): Move | null {
  const latest = obs.at(-1);
  if (!latest) return null;
  const before = [...obs].reverse().find((o) => o.date <= addDays(latest.date, -days)) ?? null;
  const year = obs.filter((o) => o.date > addDays(latest.date, -365));
  const max = Math.max(...year.map((o) => o.value)), min = Math.min(...year.map((o) => o.value));
  return { what, latest: { date: latest.date, value: latest.value }, before: before && { date: before.date, value: before.value },
    change: before ? latest.value - before.value : null,
    record: year.length > 30 ? (latest.value >= max ? "haut" : latest.value <= min ? "bas" : null) : null };
}

export function buildTrends(read: SiteReader, today: string) {
  const kw = buildKeywordsPage(read, today);
  const ideas = kw ? kw.groups.flatMap((g) => g.ideas.map((i) => ({ page: g.page, group: g.label, text: i.text, volume: i.volume, trend: i.trend }))) : [];
  const withTrend = ideas.filter((i) => i.trend !== null && i.volume >= MIN_TREND_VOLUME);
  const elecRaw = read.settingOrNull(ELEC_CATALOG_SETTING);
  const elec = elecRaw === null ? null : parseElecCatalog(elecRaw);
  const fuels = (read.settingOrNull(STATIONS_CATALOG_SETTING) as { fuels?: { id: string; label: string }[] } | null)?.fuels ?? [];
  const moves = [
    ...fuels.map((f) => move(`${f.label}, moyenne des stations (France), sur 7 jours`, read.get(stationSeriesId(AREA_FRANCE, f.id, "avg")), 7)),
    move("Baril de Brent (dollars), sur 7 jours", read.get(OIL_SERIES.brentUsd), 7),
    elec ? move("Électricité, prix de gros (€/kWh), sur 7 jours", read.get(wholesaleSeriesId(elec.wholesale.area)), 7) : null,
  ].filter((m): m is Move => m !== null);
  // le tarif que la page électricité met face au prix de gros (déclaré), à la première puissance déclarée
  const base = elec ? read.get(trvSeriesId(elec.page.compareWith.option, elec.trv.powers[0]!, elec.page.compareWith.period, TRV_PART.ttc)) : [];
  return {
    generatedAt: today,
    keywordsDate: kw?.date ?? null, keywordsStale: kw?.stale ?? null,
    searches: {
      rising: [...withTrend].sort((a, b) => b.trend! - a.trend!).slice(0, TOP),
      falling: [...withTrend].sort((a, b) => a.trend! - b.trend!).slice(0, 10),
      biggest: [...ideas].sort((a, b) => b.volume - a.volume).slice(0, TOP),
    },
    prices: moves,
    searchConsole: searchConsole(read),
    regulatedTariff: elec && base.length ? { what: `tarif Bleu ${elec.page.compareWith.option} ${elec.page.compareWith.period}, ${elec.trv.powers[0]} kVA, kWh TTC`, latest: base.at(-1)!, previous: base.at(-2) ?? null } : null,
  };
}
