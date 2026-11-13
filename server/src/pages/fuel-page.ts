// Données de la page carburants, calculées UNIQUEMENT depuis la base (séries, sources, réglages), où
// chaque chose est entrée par un plugin. Le site n'affiche que ce que cette fonction rend : aucun calcul
// côté pages, donc un seul endroit à tester et à relire.
import type { Observation, SiteReader } from "../contract.js";
import { parseFuelCatalog } from "../plugins/fuel/decl.js";
import { FUEL_CATALOG_SETTING, FUEL_PART, fuelSeriesId, OIL_SERIES } from "../plugins/fuel/series-ids.js";
import { chargeSeriesId, HIDDEN_CHARGES_SETTING } from "../plugins/hidden-charges/index.js";
import { parseFuelPageDecl, SITE_SETTING } from "../plugins/site/index.js";
import { AREA_FRANCE, STATIONS_CATALOG_SETTING, stationSeriesId } from "../plugins/stations/index.js";
import { FORECAST_SETTING, parseForecastDecl, signalId } from "../plugins/forecast/index.js";

/** Les quatre parts d'un litre, dans l'ordre d'empilement (du bas vers le haut). */
export const LITRE_PART = { oil: "oil", refine: "refine", excise: "excise", vat: "vat" } as const;
export type LitrePart = (typeof LITRE_PART)[keyof typeof LITRE_PART];
export const LITRE_PARTS: readonly LitrePart[] = [LITRE_PART.oil, LITRE_PART.refine, LITRE_PART.excise, LITRE_PART.vat];
export type Breakdown = Record<LitrePart, number>;

export type HiddenCharge = {
  id: string; label: string; description: string;
  /** null : coût répercuté réel non publié */
  eurPerLitre: number | null;
  /** date du relevé, null si non publié */
  asOf: string | null;
  source: { name: string; url: string };
};

export type ProductPage = {
  id: string;
  label: string;
  /** prix moyen à la pompe de la dernière semaine */
  litre: number;
  now: Breakdown;
  reference: Breakdown;
  annual: { year: number; parts: Breakdown }[];
  quarterly: { year: number; quarter: number; pump: number; oil: number }[];
  neighbours: { code: string; label: string; litre: number }[];
};

/** Cours du marché : moyenne sur la période de référence, et dernière valeur connue à la date des prix. */
export type Market = { brentUsd: { reference: number; now: number }; usdPerEur: { reference: number; now: number } };

/** Prix du jour en station (plugin stations) ; null si le plugin n'a jamais tourné ou est éteint. */
export type StationsToday = { date: string; fuels: { id: string; label: string; avg: number; stations: number }[] } | null;

/** Sens prévu pour la semaine qui vient. */
export const TREND = { up: "up", down: "down", flat: "flat" } as const;
export type Trend = (typeof TREND)[keyof typeof TREND];

/** Bilan réel de la méthode : semaines où le signal était net, et combien de fois le sens était juste. */
export type TrackRecord = { since: string; strongWeeks: number; strongHits: number; allWeeks: number; allHits: number };
export type ProductForecast = { id: string; label: string; trend: Trend; signal: number; asOf: string; track: TrackRecord };
export type Forecast = { products: ProductForecast[]; threshold: number } | null;

export type FuelPage = {
  asOf: string;
  referenceLabel: string;
  products: ProductPage[];
  hiddenCharges: HiddenCharge[];
  market: Market;
  stations: StationsToday;
  forecast: Forecast;
};

function forecast(read: SiteReader): Forecast {
  const raw = read.settingOrNull(FORECAST_SETTING);
  if (raw === null) return null;
  const decl = parseForecastDecl(raw);
  const products = decl.products.flatMap((fp): ProductForecast[] => {
    const signals = read.get(signalId(fp.product));
    const ttc = read.get(fuelSeriesId(decl.country, fp.product, FUEL_PART.ttc));
    const lastTtc = ttc.at(-1);
    const latest = signals.at(-1);
    // la prévision est le signal postérieur au dernier relevé de prix : sinon, rien à annoncer
    if (!latest || !lastTtc || latest.date <= lastTtc.date) return [];
    const sig = new Map(signals.map((o) => [o.date, o.value]));
    const track: TrackRecord = { since: decl.trackSince, strongWeeks: 0, strongHits: 0, allWeeks: 0, allHits: 0 };
    for (let i = 0; i + 1 < ttc.length; i++) {
      const d = ttc[i]!.date;
      const s = sig.get(d);
      if (d < decl.trackSince || s === undefined) continue;
      const move = ttc[i + 1]!.value - ttc[i]!.value;
      if (Math.abs(move) < decl.stableMove) continue;   // semaine stable : ni juste ni fausse
      const hit = Math.sign(move) === Math.sign(s);
      track.allWeeks++; if (hit) track.allHits++;
      if (Math.abs(s) > decl.threshold) { track.strongWeeks++; if (hit) track.strongHits++; }
    }
    const trend: Trend = Math.abs(latest.value) <= decl.threshold ? TREND.flat : latest.value > 0 ? TREND.up : TREND.down;
    return [{ id: fp.product, label: fp.label, trend, signal: latest.value, asOf: latest.date, track }];
  });
  return products.length ? { products, threshold: decl.threshold } : null;
}

function stationsToday(read: SiteReader): StationsToday {
  const catalog = read.settingOrNull(STATIONS_CATALOG_SETTING) as { fuels?: { id: string; label: string }[] } | null;
  if (!catalog?.fuels?.length) return null;
  let date = "";
  const fuels = catalog.fuels.flatMap((f) => {
    const avg = read.get(stationSeriesId(AREA_FRANCE, f.id, "avg")).at(-1);
    const count = read.get(stationSeriesId(AREA_FRANCE, f.id, "count")).at(-1);
    if (!avg || !count || avg.date !== count.date) return [];
    if (avg.date > date) date = avg.date;
    return [{ id: f.id, label: f.label, avg: avg.value, stations: count.value, date: avg.date }];
  });
  // on ne montre que les carburants relevés le dernier jour : pas de mélange de dates
  const today = fuels.filter((f) => f.date === date).map(({ date: _d, ...f }) => f);
  return today.length ? { date, fuels: today } : null;
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

/** Les quatre parts de chaque date où elles existent toutes (dates du prix à la pompe). */
function weeklyBreakdowns(read: SiteReader, country: string, product: string): Map<string, Breakdown> {
  const byDate = (id: string) => new Map(read.get(id).map((o: Observation) => [o.date, o.value]));
  const oil = byDate(OIL_SERIES.brentEurPerLitreWeekly);
  const refine = byDate(fuelSeriesId(country, product, FUEL_PART.margin));
  const excise = byDate(fuelSeriesId(country, product, FUEL_PART.excise));
  const vat = byDate(fuelSeriesId(country, product, FUEL_PART.vat));
  const out = new Map<string, Breakdown>();
  for (const { date } of read.get(fuelSeriesId(country, product, FUEL_PART.ttc))) {
    const o = oil.get(date), r = refine.get(date), e = excise.get(date), v = vat.get(date);
    if (o !== undefined && r !== undefined && e !== undefined && v !== undefined) out.set(date, { oil: o, refine: r, excise: e, vat: v });
  }
  return out;
}

function meanBreakdown(rows: Breakdown[]): Breakdown {
  if (!rows.length) throw new Error("page carburants : aucune donnée sur la période demandée");
  return { oil: mean(rows.map((r) => r.oil)), refine: mean(rows.map((r) => r.refine)),
    excise: mean(rows.map((r) => r.excise)), vat: mean(rows.map((r) => r.vat)) };
}

function marketPair(read: SiteReader, seriesId: string, from: string, to: string, asOf: string): { reference: number; now: number } {
  const obs = read.get(seriesId);
  const ref = obs.filter((o) => o.date >= from && o.date <= to).map((o) => o.value);
  const upTo = obs.filter((o) => o.date <= asOf);
  const now = upTo[upTo.length - 1]?.value;
  if (!ref.length || now === undefined) throw new Error(`page carburants : pas de cours pour ${seriesId}`);
  return { reference: mean(ref), now };
}

function hiddenCharges(read: SiteReader): HiddenCharge[] {
  const ids = read.setting(HIDDEN_CHARGES_SETTING);
  if (!Array.isArray(ids)) throw new Error(`réglage ${HIDDEN_CHARGES_SETTING} : liste attendue`);
  return ids.map((id: string) => {
    const s = read.series(chargeSeriesId(id));
    const src = s ? read.source(s.sourceId) : null;
    if (!s || !src) throw new Error(`charge cachée ${id} : série ou source absente de la base`);
    const last = read.get(s.id).at(-1);
    return { id, label: s.label, description: s.description ?? "", eurPerLitre: last?.value ?? null, asOf: last?.date ?? null,
      source: { name: src.name, url: src.url } };
  });
}

export function buildFuelPage(read: SiteReader): FuelPage {
  const decl = parseFuelPageDecl(read.setting(SITE_SETTING.fuelPage));
  const fuel = parseFuelCatalog(read.setting(FUEL_CATALOG_SETTING));
  const { country } = decl;
  const labelOf = new Map(fuel.countries.map((c) => [c.code, c.label]));
  let asOf = "";
  const products = decl.products.map((id): ProductPage => {
    const product = fuel.products.find((p) => p.id === id);
    if (!product) throw new Error(`page carburants : produit inconnu ${id}`);
    const weeks = weeklyBreakdowns(read, country, id);
    const dates = [...weeks.keys()].sort();
    const last = dates[dates.length - 1];
    if (!last) throw new Error(`page carburants : aucune semaine complète pour ${id}`);
    if (last > asOf) asOf = last;
    const now = weeks.get(last)!;
    const ttcAt = (c: string) => read.get(fuelSeriesId(c, id, FUEL_PART.ttc)).find((o) => o.date === last)?.value;

    const years = new Map<number, Breakdown[]>();
    for (const d of dates) if (d >= decl.historyFrom) {
      const y = Number(d.slice(0, 4));
      (years.get(y) ?? years.set(y, []).get(y)!).push(weeks.get(d)!);
    }
    const crude = new Map(read.get(OIL_SERIES.brentEurPerLitreWeekly).map((o) => [o.date, o.value]));
    const quarters = new Map<string, { pump: number[]; oil: number[] }>();
    for (const o of read.get(fuelSeriesId(country, id, FUEL_PART.ttc))) {
      const k = crude.get(o.date);
      if (o.date < decl.historyFrom || k === undefined) continue;
      const key = `${o.date.slice(0, 4)}-${Math.floor((Number(o.date.slice(5, 7)) - 1) / 3) + 1}`;
      const q = quarters.get(key) ?? quarters.set(key, { pump: [], oil: [] }).get(key)!;
      q.pump.push(o.value); q.oil.push(k);
    }
    return {
      id, label: product.label,
      litre: ttcAt(country) ?? LITRE_PARTS.reduce((s, p) => s + now[p], 0),
      now,
      reference: meanBreakdown(dates.filter((d) => d >= decl.reference.from && d <= decl.reference.to).map((d) => weeks.get(d)!)),
      annual: [...years].sort((a, b) => a[0] - b[0]).map(([year, rows]) => ({ year, parts: meanBreakdown(rows) })),
      quarterly: [...quarters].sort((a, b) => a[0].localeCompare(b[0])).map(([key, q]) => {
        const [y, qq] = key.split("-").map(Number);
        return { year: y!, quarter: qq!, pump: mean(q.pump), oil: mean(q.oil) };
      }),
      neighbours: decl.neighbours.map((c) => {
        const litre = ttcAt(c);
        if (litre === undefined) throw new Error(`page carburants : pas de prix ${id} pour ${c} le ${last}`);
        return { code: c, label: labelOf.get(c) ?? c, litre };
      }),
    };
  });
  const { from, to } = decl.reference;
  return {
    asOf, referenceLabel: decl.reference.label, products, hiddenCharges: hiddenCharges(read),
    market: { brentUsd: marketPair(read, OIL_SERIES.brentUsd, from, to, asOf), usdPerEur: marketPair(read, OIL_SERIES.eurusd, from, to, asOf) },
    stations: stationsToday(read),
    forecast: forecast(read),
  };
}
