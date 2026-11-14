// Plugin « stations » : chaque station-service du flux officiel, chaque jour, et nos propres moyennes.
//
// Deux instantanés tirés d'un seul téléchargement :
//   - stations.today  : la fiche complète de chaque station (position, adresse, prix), gardée quelques
//                       semaines pour la carte ;
//   - stations.prices : le prix à jour de chaque station, par carburant, gardé sans limite pratique
//                       (historyDays) : c'est notre historique, d'où se calculent les moyennes par ville,
//                       département, région et pour la France.
// Seuls les prix mis à jour récemment comptent : une station fermée garde son dernier prix affiché, il ne
// doit pas peser dans la moyenne.
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Observation, type Plugin, type SnapshotItem, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { addDays, parisDate } from "../../units.js";

export type StationFuel = { id: string; label: string; field: string };
export type StationsDecl = {
  source: SourceDecl;
  fuels: StationFuel[];
  maxAgeDays: number;
  plausible: { min: number; max: number };
  departments: { code: string; label: string }[];
  regions: { code: string; label: string }[];
  /** jours de fiches complètes gardés (carte, variation sur une semaine) */
  keepDays: number;
  /** jours d'historique des prix station par station gardés */
  historyDays: number;
};

/** Instantané historique : le prix à jour de chaque station, compact. */
export const STATION_PRICES_SNAPSHOT = "stations.prices";
export type StationPrices = { dep: string; region: string; cp: string; city: string; p: Record<string, number> };

/** Instantané quotidien : chaque station, sa position, son adresse et ses prix. */
export const STATIONS_SNAPSHOT = "stations.today";
export type StationPrice = { price: number; updated: string };
export type StationRecord = {
  lat: number; lon: number; address: string; city: string; cp: string; dep: string; region: string;
  /** automate 24 h sur 24 */
  h24: boolean;
  /** par identifiant de carburant (`gazole`, `e10`...) ; absent si la station ne l'affiche pas */
  prices: Record<string, StationPrice>;
};

/** Réglage en base : carburants et départements, avec leurs noms, pour les pages. */
export const STATIONS_CATALOG_SETTING = "stations.catalog";
export const stationSeriesId = (area: string, fuel: string, what: "avg" | "count") => `station.${area}.${fuel}.${what}`;
/** Zone « toute la France » ; un département est « dep-<code> ». */
export const AREA_FRANCE = "FR";
export const areaOfDepartment = (code: string) => `dep-${code}`;
export const areaOfRegion = (code: string) => `reg-${code}`;

type Obj = Record<string, unknown>;
const need = (o: Obj, k: string, where: string): string => {
  if (typeof o[k] !== "string" || !o[k]) throw new Error(`stations.json, ${where} : « ${k} » manquant`);
  return o[k] as string;
};
const list = (v: unknown, where: string): Obj[] => {
  if (!Array.isArray(v) || !v.length) throw new Error(`stations.json : « ${where} » doit être une liste non vide`);
  return v as Obj[];
};

export function parseStationsDecl(json: unknown): StationsDecl {
  const o = (json ?? {}) as Obj, s = (o.source ?? {}) as Obj, p = (o.plausible ?? {}) as Obj;
  const n = (v: unknown, k: string) => { if (typeof v !== "number" || !(v > 0)) throw new Error(`stations.json : « ${k} » doit être un nombre positif`); return v; };
  const fuels = list(o.fuels, "fuels").map((f, i) => {
    const field = need(f, "field", `fuels[${i}]`);
    // le nom de champ entre dans une requête : on n'accepte qu'un identifiant simple
    if (!/^[a-z0-9_]+$/.test(field)) throw new Error(`stations.json, fuels[${i}] : champ invalide « ${field} »`);
    return { id: need(f, "id", `fuels[${i}]`), label: need(f, "label", `fuels[${i}]`), field };
  });
  const min = n(p.min, "plausible.min"), max = n(p.max, "plausible.max");
  if (min >= max) throw new Error("stations.json : plausible.min doit être inférieur à plausible.max");
  return {
    source: { id: need(s, "id", "source"), name: need(s, "name", "source"), publisher: need(s, "publisher", "source"), url: need(s, "url", "source"), licence: need(s, "licence", "source") },
    fuels, maxAgeDays: n(o.maxAgeDays, "maxAgeDays"), plausible: { min, max },
    departments: list(o.departments, "departments").map((d, i) => ({ code: need(d, "code", `departments[${i}]`), label: need(d, "label", `departments[${i}]`) })),
    regions: list(o.regions, "regions").map((d, i) => ({ code: need(d, "code", `regions[${i}]`), label: need(d, "label", `regions[${i}]`) })),
    keepDays: n(o.keepDays, "keepDays"), historyDays: n(o.historyDays, "historyDays"),
  };
}

/** Export complet du flux, limité aux champs utiles (une requête, environ 10 000 stations). */
export function stationExportUrl(decl: StationsDecl): string {
  const fields = ["id", "geom", "adresse", "ville", "cp", "code_departement", "code_region", "horaires_automate_24_24",
    ...decl.fuels.flatMap((f) => [`${f.field}_prix`, `${f.field}_maj`])];
  return `${decl.source.url}/exports/json?${new URLSearchParams({ select: fields.join(",") }).toString()}`;
}

/** Une station par élément. Un prix hors des bornes plausibles est écarté (erreur de saisie d'une station,
 *  il y en a toujours quelques-unes) ; une station sans position ou sans aucun prix aussi. */
export function parseStationExport(text: string, decl: StationsDecl): SnapshotItem[] {
  const rows = JSON.parse(text) as unknown;
  if (!Array.isArray(rows)) throw new Error("flux des stations : l'export n'est pas une liste (format changé ?)");
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
  const seen = new Set<string>();
  return (rows as Obj[]).flatMap((r): SnapshotItem[] => {
    const id = str(r.id), g = (r.geom ?? {}) as Obj;
    if (!id || seen.has(id) || typeof g.lat !== "number" || typeof g.lon !== "number") return [];
    const prices: Record<string, StationPrice> = {};
    for (const f of decl.fuels) {
      const price = r[`${f.field}_prix`], updated = r[`${f.field}_maj`];
      if (typeof price === "number" && price >= decl.plausible.min && price <= decl.plausible.max && typeof updated === "string")
        prices[f.id] = { price, updated: updated.slice(0, 10) };
    }
    if (!Object.keys(prices).length) return [];
    seen.add(id);
    const value: StationRecord = { lat: g.lat, lon: g.lon, address: str(r.adresse), city: str(r.ville), cp: str(r.cp), dep: str(r.code_departement), region: str(r.code_region),
      h24: r.horaires_automate_24_24 === "Oui", prices };
    return [{ key: id, value }];
  });
}

/** Les prix à jour (mis à jour depuis `maxAgeDays` jours au plus) de chaque station : l'historique. */
export function stationPrices(items: readonly SnapshotItem[], date: string, maxAgeDays: number): SnapshotItem[] {
  const since = addDays(date, -maxAgeDays);
  return items.flatMap((it): SnapshotItem[] => {
    const st = it.value as StationRecord;
    const p: Record<string, number> = {};
    for (const [fuel, x] of Object.entries(st.prices)) if (x.updated >= since) p[fuel] = x.price;
    if (!Object.keys(p).length) return [];
    const value: StationPrices = { dep: st.dep, region: st.region, cp: st.cp, city: st.city, p };
    return [{ key: it.key, value }];
  });
}

/** Nos moyennes du jour, depuis les prix des stations : France, régions et départements déclarés. */
export function stationAverages(items: readonly SnapshotItem[], date: string, decl: StationsDecl): Observation[] {
  const deps = new Set(decl.departments.map((d) => d.code)), regs = new Set(decl.regions.map((r) => r.code));
  const acc = new Map<string, { sum: number; n: number }>();
  const add = (area: string, fuel: string, v: number) => {
    const k = `${area}|${fuel}`, a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += v; a.n++; acc.set(k, a);
  };
  for (const it of items) {
    const st = it.value as StationPrices;
    for (const [fuel, v] of Object.entries(st.p)) {
      add(AREA_FRANCE, fuel, v);
      if (deps.has(st.dep)) add(areaOfDepartment(st.dep), fuel, v);
      if (regs.has(st.region)) add(areaOfRegion(st.region), fuel, v);
    }
  }
  const fuels = new Set(decl.fuels.map((f) => f.id));
  return [...acc].flatMap(([k, a]) => {
    const [area, fuel] = k.split("|") as [string, string];
    if (!fuels.has(fuel)) return [];
    // pas de contrôle de la moyenne : chaque prix est déjà dans les bornes plausibles, une moyenne de prix
    // plausibles l'est forcément. Une unité changée à la source écarte tous les prix : instantané vide, la
    // collecte échoue (témoin dans les essais).
    const avg = a.sum / a.n;
    return [{ seriesId: stationSeriesId(area, fuel, "avg"), date, value: avg }, { seriesId: stationSeriesId(area, fuel, "count"), date, value: a.n }];
  });
}

export { parisDate };

export const stationsPlugin: Plugin = {
  id: "stations",
  title: { fr: "Stations", en: "Fuel stations" },
  description: { fr: "Prix moyen du jour de chaque carburant (gazole, SP95, E10, SP98, E85, GPL), en France et par département.",
    en: "Daily average price of each fuel in France and by department." },
  category: PLUGIN_CATEGORY.data,
  settings: jsonSettings(parseStationsDecl, { fr: "Source, carburants, fraîcheur des prix retenus (jours), bornes plausibles, départements. Pris en compte à la prochaine collecte.",
    en: "Source, fuels, price freshness (days), plausible bounds, departments. Applied at the next collection." }),
  register(api) {
    const decl = parseStationsDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSetting({ key: STATIONS_CATALOG_SETTING, value: { fuels: decl.fuels.map(({ id, label }) => ({ id, label })), departments: decl.departments, maxAgeDays: decl.maxAgeDays } });
    const areas = [{ area: AREA_FRANCE, label: "France" },
      ...decl.regions.map((r) => ({ area: areaOfRegion(r.code), label: r.label })),
      ...decl.departments.map((d) => ({ area: areaOfDepartment(d.code), label: d.label }))];
    for (const f of decl.fuels) for (const a of areas) {
      api.declareSeries({ id: stationSeriesId(a.area, f.id, "avg"), label: `${f.label}, ${a.label} : prix moyen en station`, unit: UNIT.eurPerLitre,
        frequency: FREQUENCY.daily, sourceId: decl.source.id });
      api.declareSeries({ id: stationSeriesId(a.area, f.id, "count"), label: `${f.label}, ${a.label} : stations à prix à jour`, unit: UNIT.stations,
        frequency: FREQUENCY.daily, sourceId: decl.source.id });
    }
    api.declareSnapshot({ id: STATIONS_SNAPSHOT, label: "Chaque station : position, adresse et prix du jour", sourceId: decl.source.id, keepDays: decl.keepDays });
    api.registerSnapshotCollector({ id: "stations.list", snapshot: STATIONS_SNAPSHOT,
      run: async (ctx) => ({ date: parisDate(), items: parseStationExport(await ctx.fetchText(stationExportUrl(decl)), decl) }) });
    api.declareSnapshot({ id: STATION_PRICES_SNAPSHOT, label: "Prix à jour de chaque station (historique)", sourceId: decl.source.id, keepDays: decl.historyDays });
    api.registerSnapshotCollector({ id: "stations.prices", snapshot: STATION_PRICES_SNAPSHOT, run: async (ctx) => {
      const date = parisDate();
      return { date, items: stationPrices(parseStationExport(await ctx.fetchText(stationExportUrl(decl)), decl), date, decl.maxAgeDays) };
    } });
    // nos moyennes : calculées sur le relevé du jour, une fois les instantanés écrits
    api.registerDerivation({ id: "stations.averages", run: (read) => {
      const date = read.snapshotDates(STATION_PRICES_SNAPSHOT).at(-1);
      return date ? stationAverages(read.snapshot(STATION_PRICES_SNAPSHOT, date), date, decl) : [];
    } });
  },
};
