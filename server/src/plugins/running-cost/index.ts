// Plugin « coût aux 100 km » : chaque motorisation, sa consommation de référence et d'où vient son prix.
// Il ne relève presque rien lui-même : les prix viennent du plugin stations (prix du jour) et du plugin
// électricité (tarif réglementé). Seuls les prix sans flux public (recharge rapide) sont des relevés
// déclarés, datés et sourcés, écrits en base comme une série.
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Plugin } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";

/** Ce qu'on mesure à la pompe ou à la prise. */
export const ENERGY_UNIT = { litre: "L", kwh: "kWh" } as const;
export type EnergyUnit = (typeof ENERGY_UNIT)[keyof typeof ENERGY_UNIT];
const ENERGY_UNITS: readonly EnergyUnit[] = Object.values(ENERGY_UNIT);

export type Link = { name: string; url: string };
export type Consumption = { id: string; value: number; unit: EnergyUnit; label: string; source: Link };
export type Reference = { id: string; label: string; eurPerUnit: number; unit: EnergyUnit; asOf: string; source: Link };
/** D'où vient le prix d'une motorisation : un carburant du plugin stations, un prix du tarif réglementé, ou un relevé déclaré. */
export type PriceFrom = { station: string } | { trv: { option: string; period: string } } | { reference: string };
export type Vehicle = { id: string; label: string; consumption: string; price: PriceFrom; factor: { value: number; why: string; source: Link } | null };
export type RunningCostCatalog = {
  distance: { default: number; min: number; max: number; step: number; source: Link };
  consumptions: Consumption[];
  references: Reference[];
  vehicles: Vehicle[];
};

export const RUNNING_COST_SETTING = "running-cost.catalog";
export const referenceSeriesId = (id: string) => `cost.reference.${id}`;
export const referenceSourceId = (id: string) => `cost-reference-${id}`;

type Obj = Record<string, unknown>;
const fail = (where: string, what: string): never => { throw new Error(`running-cost.json, ${where} : ${what}`); };
const obj = (o: unknown, where: string): Obj => (o && typeof o === "object" && !Array.isArray(o) ? (o as Obj) : fail(where, "objet attendu"));
const str = (o: Obj, k: string, where: string): string => (typeof o[k] === "string" && o[k] ? (o[k] as string) : fail(where, `« ${k} » manquant`));
const pos = (o: Obj, k: string, where: string): number => (typeof o[k] === "number" && (o[k] as number) > 0 ? (o[k] as number) : fail(where, `« ${k} » doit être un nombre positif`));
const list = (o: unknown, where: string): unknown[] => (Array.isArray(o) && o.length ? o : fail(where, "liste non vide attendue"));
const link = (o: unknown, where: string): Link => { const l = obj(o, where); return { name: str(l, "name", where), url: str(l, "url", where) }; };
const unit = (o: Obj, where: string): EnergyUnit => ENERGY_UNITS.find((u) => u === o.unit) ?? fail(where, `unité inconnue « ${String(o.unit)} »`);
function ids<T extends { id: string }>(xs: T[], where: string): T[] {
  const seen = new Set<string>();
  for (const x of xs) { if (seen.has(x.id)) fail(where, `identifiant en double « ${x.id} »`); seen.add(x.id); }
  return xs;
}

export function parseRunningCost(json: unknown): RunningCostCatalog {
  const root = obj(json, "racine");
  const d = obj(root.distance, "distance");
  const distance = { default: pos(d, "default", "distance"), min: pos(d, "min", "distance"), max: pos(d, "max", "distance"), step: pos(d, "step", "distance"), source: link(d.source, "distance.source") };
  if (!(distance.min <= distance.default && distance.default <= distance.max)) fail("distance", "la valeur par défaut doit être entre min et max");
  // hors de la grille du curseur, le navigateur arrondit en silence et affiche une autre distance
  if (Math.abs(((distance.default - distance.min) / distance.step) - Math.round((distance.default - distance.min) / distance.step)) > 1e-9) fail("distance", "la valeur par défaut doit tomber sur un pas du curseur (min + n × step)");
  const consumptions = ids(list(root.consumptions, "consumptions").map((x, i): Consumption => {
    const w = `consumptions[${i}]`, c = obj(x, w);
    return { id: str(c, "id", w), value: pos(c, "value", w), unit: unit(c, w), label: str(c, "label", w), source: link(c.source, `${w}.source`) };
  }), "consumptions");
  const references = ids((Array.isArray(root.references) ? root.references : []).map((x, i): Reference => {
    const w = `references[${i}]`, r = obj(x, w);
    const asOf = str(r, "asOf", w);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) fail(w, "asOf au format AAAA-MM-JJ");
    return { id: str(r, "id", w), label: str(r, "label", w), eurPerUnit: pos(r, "eurPerUnit", w), unit: unit(r, w), asOf, source: link(r.source, `${w}.source`) };
  }), "references");
  const vehicles = ids(list(root.vehicles, "vehicles").map((x, i): Vehicle => {
    const w = `vehicles[${i}]`, v = obj(x, w);
    const consumption = str(v, "consumption", w);
    if (!consumptions.some((c) => c.id === consumption)) fail(w, `consommation inconnue « ${consumption} »`);
    const p = obj(v.price, `${w}.price`);
    let price: PriceFrom;
    if (typeof p.station === "string") price = { station: p.station };
    else if (p.trv !== undefined) { const t = obj(p.trv, `${w}.price.trv`); price = { trv: { option: str(t, "option", `${w}.price.trv`), period: str(t, "period", `${w}.price.trv`) } }; }
    else if (typeof p.reference === "string") {
      const ref = references.find((r) => r.id === p.reference) ?? fail(w, `prix de référence inconnu « ${String(p.reference)} »`);
      const cons = consumptions.find((c) => c.id === consumption)!;
      if (ref.unit !== cons.unit) fail(w, `prix en ${ref.unit} pour une consommation en ${cons.unit}`);
      price = { reference: ref.id };
    } else price = fail(w, "price : station, trv ou reference attendu");
    // absent dans la déclaration, null dans le catalogue stocké en base : les deux veulent dire « aucun »
    const f = v.factor === undefined || v.factor === null ? null : obj(v.factor, `${w}.factor`);
    return { id: str(v, "id", w), label: str(v, "label", w), consumption, price,
      factor: f ? { value: pos(f, "value", `${w}.factor`), why: str(f, "why", `${w}.factor`), source: link(f.source, `${w}.factor.source`) } : null };
  }), "vehicles");
  return { distance, consumptions, references, vehicles };
}

const UNIT_OF = { [ENERGY_UNIT.litre]: UNIT.eurPerLitre, [ENERGY_UNIT.kwh]: UNIT.eurPerKwh } satisfies Record<EnergyUnit, string>;

export const runningCostPlugin: Plugin = {
  id: "running-cost",
  title: { fr: "Coût aux 100 km", en: "Cost per 100 km" },
  description: { fr: "Chaque motorisation côte à côte : consommation de référence et prix du jour, du gazole à l'électrique sur borne rapide.",
    en: "Every powertrain side by side: reference consumption and today's price, from diesel to fast charging." },
  category: PLUGIN_CATEGORY.data,
  settings: jsonSettings(parseRunningCost, { fr: "Motorisations, consommations de référence et prix déclarés (avec source et date). Pris en compte à la prochaine collecte.",
    en: "Powertrains, reference consumptions and declared prices (with source and date). Applied at the next collection." }),
  register(api) {
    const cat = parseRunningCost(api.settings());
    api.declareSetting({ key: RUNNING_COST_SETTING, value: cat });
    for (const r of cat.references) {
      api.declareSource({ id: referenceSourceId(r.id), name: r.source.name, publisher: r.source.name, url: r.source.url, licence: "Citation avec mention de la source" });
      api.declareSeries({ id: referenceSeriesId(r.id), label: r.label, unit: UNIT_OF[r.unit], frequency: FREQUENCY.onChange, sourceId: referenceSourceId(r.id) });
    }
    api.registerCollector({ id: "running-cost.references", run: async () => cat.references.map((r) => ({ seriesId: referenceSeriesId(r.id), date: r.asOf, value: r.eurPerUnit })) });
  },
};
