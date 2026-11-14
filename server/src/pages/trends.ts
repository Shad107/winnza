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
    regulatedTariff: elec && base.length ? { what: `tarif Bleu ${elec.page.compareWith.option} ${elec.page.compareWith.period}, ${elec.trv.powers[0]} kVA, kWh TTC`, latest: base.at(-1)!, previous: base.at(-2) ?? null } : null,
  };
}
