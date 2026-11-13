// Données de la page carburants, calculées UNIQUEMENT depuis la base (séries, sources, réglages), où
// chaque chose est entrée par un plugin. Le site n'affiche que ce que cette fonction rend : aucun calcul
// côté pages, donc un seul endroit à tester et à relire.
import type { Observation, SiteReader } from "../contract.js";
import { parseFuelCatalog } from "../plugins/fuel/decl.js";
import { FUEL_CATALOG_SETTING, FUEL_PART, fuelSeriesId, OIL_SERIES } from "../plugins/fuel/series-ids.js";
import { chargeSeriesId, HIDDEN_CHARGES_SETTING } from "../plugins/hidden-charges/index.js";
import { parseFuelPageDecl, SITE_SETTING } from "../plugins/site/index.js";

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

export type FuelPage = {
  asOf: string;
  referenceLabel: string;
  products: ProductPage[];
  hiddenCharges: HiddenCharge[];
  market: Market;
};

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
  };
}
