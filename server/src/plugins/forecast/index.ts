// Plugin « prévision » : le prix à la pompe va-t-il monter ou baisser la semaine prochaine ?
//
// Méthode, validée sur l'historique avant d'être publiée (2026-11-14) : le prix à la pompe suit avec
// environ une semaine de retard le prix du PRODUIT RAFFINÉ (gazole et essence sur les marchés de gros),
// mieux que celui du pétrole brut depuis 2022 (marges de raffinage très volatiles). On compare la
// moyenne des 5 derniers jours de cotation à celle d'il y a une semaine, en euros par litre.
//
// Le plugin ne promet rien : la page affiche aussi son BILAN, recalculé à chaque collecte à partir des
// résultats réels (signal donné, puis vrai mouvement du prix la semaine suivante).
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Observation, type Plugin, type SeriesReader, type SourceDecl } from "../../contract.js";
import { addDays } from "../../units.js";
import { FUEL_PART, fuelSeriesId, OIL_SERIES } from "../fuel/series-ids.js";
import { parseFredCsv } from "../fuel/parse.js";
import { jsonSettings } from "../json-settings.js";

export type ForecastProduct = { product: string; fredSeries: string; label: string };
export type ForecastDecl = {
  source: SourceDecl;
  country: string;
  products: ForecastProduct[];
  /** jours de cotation moyennés (fenêtre courante et fenêtre d'il y a une semaine) */
  windowDays: number;
  /** variation (€/L) sous laquelle le signal est jugé faible : « pas de tendance nette » */
  threshold: number;
  /** variation de prix à la pompe (€/L) sous laquelle une semaine est jugée stable (exclue du bilan) */
  stableMove: number;
  /** début de la période du bilan affiché */
  trackSince: string;
};

/** Réglage en base lu par la page. */
export const FORECAST_SETTING = "forecast.catalog";
export const LITRES_PER_US_GALLON = 3.785411784;
export const refinedUsdId = (product: string) => `forecast.${product}.refined_usd_per_gallon`;
export const refinedEurId = (product: string) => `forecast.${product}.refined_eur_per_litre`;
/** signal hebdomadaire : variation du produit raffiné sur une semaine, à chaque date (€/L) */
export const signalId = (product: string) => `forecast.${product}.signal`;

type Obj = Record<string, unknown>;
export function parseForecastDecl(json: unknown): ForecastDecl {
  const o = (json ?? {}) as Obj, s = (o.source ?? {}) as Obj;
  const str = (v: unknown, k: string) => { if (typeof v !== "string" || !v) throw new Error(`prévision : « ${k} » manquant`); return v; };
  const pos = (v: unknown, k: string) => { if (typeof v !== "number" || !(v > 0)) throw new Error(`prévision : « ${k} » doit être un nombre positif`); return v; };
  if (!Array.isArray(o.products) || !o.products.length) throw new Error("prévision : « products » doit être une liste non vide");
  return {
    source: { id: str(s.id, "source.id"), name: str(s.name, "source.name"), publisher: str(s.publisher, "source.publisher"), url: str(s.url, "source.url"), licence: str(s.licence, "source.licence") },
    country: str(o.country, "country"),
    products: (o.products as Obj[]).map((p, i) => {
      const fred = str(p.fredSeries, `products[${i}].fredSeries`);
      if (!/^[A-Z0-9]+$/.test(fred)) throw new Error(`prévision : série FRED invalide « ${fred} »`);
      return { product: str(p.product, `products[${i}].product`), fredSeries: fred, label: str(p.label, `products[${i}].label`) };
    }),
    windowDays: pos(o.windowDays, "windowDays"), threshold: pos(o.threshold, "threshold"), stableMove: pos(o.stableMove, "stableMove"),
    trackSince: str(o.trackSince, "trackSince"),
  };
}

/** Moyenne des `n` dernières valeurs strictement avant `end`. */
function meanBefore(series: readonly Observation[], end: string, n: number): number | null {
  let lo = 0, hi = series.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (series[mid]!.date < end) lo = mid + 1; else hi = mid; }
  if (lo < n) return null;
  let s = 0;
  for (let i = lo - n; i < lo; i++) s += series[i]!.value;
  return s / n;
}

/** Variation sur une semaine du produit raffiné, vue à la date `date`. */
export function weeklySignal(refined: readonly Observation[], date: string, windowDays: number): number | null {
  const now = meanBefore(refined, date, windowDays);
  const before = meanBefore(refined, addDays(date, -7), windowDays);
  return now === null || before === null ? null : now - before;
}

export function deriveRefinedEur(read: SeriesReader, product: string): Observation[] {
  const fx = new Map(read.get(OIL_SERIES.eurusd).map((o) => [o.date, o.value]));
  return read.get(refinedUsdId(product)).flatMap((o) => {
    const usdPerEur = fx.get(o.date);
    return usdPerEur ? [{ seriesId: refinedEurId(product), date: o.date, value: o.value / usdPerEur / LITRES_PER_US_GALLON }] : [];
  });
}

/** Signal à chaque relevé hebdomadaire du prix à la pompe, et au lendemain du dernier jour coté (la
 *  prévision de la semaine qui vient). */
export function deriveSignals(read: SeriesReader, decl: ForecastDecl, product: string): Observation[] {
  const refined = read.get(refinedEurId(product));
  const last = refined.at(-1);
  if (!last) return [];
  const dates = read.get(fuelSeriesId(decl.country, product, FUEL_PART.ttc)).map((o) => o.date);
  const out: Observation[] = [];
  for (const d of [...dates, addDays(last.date, 1)]) {
    const s = weeklySignal(refined, d, decl.windowDays);
    if (s !== null) out.push({ seriesId: signalId(product), date: d, value: s });
  }
  return out;
}

export const forecastPlugin: Plugin = {
  id: "forecast",
  title: { fr: "Prévision", en: "Forecast" },
  description: { fr: "Le prix à la pompe va-t-il monter ou baisser la semaine prochaine ? D'après le produit raffiné, avec le bilan réel de la méthode.",
    en: "Will pump prices rise or fall next week? From refined product prices, with the method's real track record." },
  category: PLUGIN_CATEGORY.data,
  settings: jsonSettings(parseForecastDecl, { fr: "Séries FRED du produit raffiné par carburant, fenêtre, seuils, début du bilan. Pris en compte à la prochaine collecte.",
    en: "FRED refined-product series per fuel, window, thresholds, track-record start. Applied at the next collection." }),
  register(api) {
    const decl = parseForecastDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSetting({ key: FORECAST_SETTING, value: decl });
    for (const p of decl.products) {
      api.declareSeries({ id: refinedUsdId(p.product), label: `${p.label} : produit raffiné (marché de gros)`, unit: UNIT.usdPerGallon, frequency: FREQUENCY.daily, sourceId: decl.source.id });
      api.declareSeries({ id: refinedEurId(p.product), label: `${p.label} : produit raffiné, en euros par litre`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.daily,
        sourceId: decl.source.id, derivedFrom: [refinedUsdId(p.product)] });
      api.declareSeries({ id: signalId(p.product), label: `${p.label} : variation du produit raffiné sur une semaine`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.weekly,
        sourceId: decl.source.id, derivedFrom: [refinedEurId(p.product)] });
      api.registerCollector({ id: `forecast.${p.product}`, run: async (ctx) =>
        parseFredCsv(await ctx.fetchText(`${decl.source.url}?id=${p.fredSeries}`), refinedUsdId(p.product)) });
      // l'euro/dollar vient du plugin carburants : s'il est éteint, pas de conversion, donc pas de signal
      api.registerDerivation({ id: `forecast.${p.product}.eur`, run: (read) => deriveRefinedEur(read, p.product) });
      api.registerDerivation({ id: `forecast.${p.product}.signal`, run: (read) => deriveSignals(read, decl, p.product) });
    }
  },
};
