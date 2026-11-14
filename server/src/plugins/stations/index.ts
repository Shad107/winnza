// Plugin « stations » : prix moyen du jour de chaque carburant (gazole, SP95, E10, SP98, E85, GPL), en
// France et par département, depuis le flux officiel des stations-service. La moyenne est calculée par
// la source elle-même (requête agrégée), seulement sur les prix mis à jour récemment : une station
// fermée garde son dernier prix affiché, il ne doit pas peser dans la moyenne.
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Observation, type Plugin, type SnapshotItem, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";

export type StationFuel = { id: string; label: string; field: string };
export type StationsDecl = {
  source: SourceDecl;
  fuels: StationFuel[];
  maxAgeDays: number;
  plausible: { min: number; max: number };
  departments: { code: string; label: string }[];
  /** jours de relevés station par station gardés (variation sur une semaine, et un peu de recul) */
  keepDays: number;
};

/** Instantané quotidien : chaque station, sa position, son adresse et ses prix. */
export const STATIONS_SNAPSHOT = "stations.today";
export type StationPrice = { price: number; updated: string };
export type StationRecord = {
  lat: number; lon: number; address: string; city: string; cp: string; dep: string;
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
    keepDays: n(o.keepDays, "keepDays"),
  };
}

/** Les deux requêtes agrégées d'un carburant : France entière, et par département. */
export function stationQueries(decl: StationsDecl, fuel: StationFuel): { national: string; byDepartment: string } {
  const where = `${fuel.field}_maj >= now(days=-${decl.maxAgeDays}) and ${fuel.field}_prix > 0`;
  const q = (params: Record<string, string>) => `${decl.source.url}/records?${new URLSearchParams(params).toString()}`;
  return {
    national: q({ select: `avg(${fuel.field}_prix) as avg, count(*) as n`, where, limit: "1" }),
    byDepartment: q({ select: `code_departement, avg(${fuel.field}_prix) as avg, count(*) as n`, where, group_by: "code_departement", limit: "200" }),
  };
}

/** Export complet du flux, limité aux champs utiles (une requête, environ 10 000 stations). */
export function stationExportUrl(decl: StationsDecl): string {
  const fields = ["id", "geom", "adresse", "ville", "cp", "code_departement", "horaires_automate_24_24",
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
    const value: StationRecord = { lat: g.lat, lon: g.lon, address: str(r.adresse), city: str(r.ville), cp: str(r.cp), dep: str(r.code_departement),
      h24: r.horaires_automate_24_24 === "Oui", prices };
    return [{ key: id, value }];
  });
}

/** Lignes d'une réponse agrégée : { avg, n, code_departement? }. */
export function parseAggregate(text: string): { avg: number; n: number; dep: string | null }[] {
  const results = (JSON.parse(text) as { results?: Obj[] }).results;
  if (!Array.isArray(results)) throw new Error("flux des stations : réponse sans « results » (format changé ?)");
  return results.flatMap((r) => (typeof r.avg === "number" && typeof r.n === "number" && r.n > 0
    ? [{ avg: r.avg, n: r.n, dep: typeof r.code_departement === "string" ? r.code_departement : null }] : []));
}

/** Date du jour à Paris (AAAA-MM-JJ) : la journée des automobilistes, pas celle du serveur. */
export const parisDate = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

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
    const areas = [{ area: AREA_FRANCE, label: "France" }, ...decl.departments.map((d) => ({ area: areaOfDepartment(d.code), label: d.label }))];
    for (const f of decl.fuels) for (const a of areas) {
      api.declareSeries({ id: stationSeriesId(a.area, f.id, "avg"), label: `${f.label}, ${a.label} : prix moyen en station`, unit: UNIT.eurPerLitre,
        frequency: FREQUENCY.daily, sourceId: decl.source.id });
      api.declareSeries({ id: stationSeriesId(a.area, f.id, "count"), label: `${f.label}, ${a.label} : stations qui l'affichent`, unit: UNIT.stations,
        frequency: FREQUENCY.daily, sourceId: decl.source.id });
    }
    api.declareSnapshot({ id: STATIONS_SNAPSHOT, label: "Chaque station : position, adresse et prix du jour", sourceId: decl.source.id, keepDays: decl.keepDays });
    api.registerSnapshotCollector({ id: "stations.list", snapshot: STATIONS_SNAPSHOT,
      run: async (ctx) => ({ date: parisDate(), items: parseStationExport(await ctx.fetchText(stationExportUrl(decl)), decl) }) });
    const known = new Set(decl.departments.map((d) => d.code));
    api.registerCollector({
      id: "stations.daily",
      run: async (ctx) => {
        const date = parisDate();
        const out: Observation[] = [];
        for (const f of decl.fuels) {
          const q = stationQueries(decl, f);
          const national = parseAggregate(await ctx.fetchText(q.national))[0];
          if (!national) throw new Error(`stations : aucun prix récent pour ${f.label}`);
          const rows = [{ ...national, dep: null }, ...parseAggregate(await ctx.fetchText(q.byDepartment)).filter((r) => r.dep && known.has(r.dep))];
          for (const r of rows) {
            // une moyenne absurde (mauvaise unité, donnée corrompue) arrête la collecte au lieu d'être affichée
            if (r.avg < decl.plausible.min || r.avg > decl.plausible.max)
              throw new Error(`stations : ${f.label} ${r.dep ?? "France"} à ${r.avg} €/L, hors des bornes plausibles`);
            const area = r.dep ? areaOfDepartment(r.dep) : AREA_FRANCE;
            out.push({ seriesId: stationSeriesId(area, f.id, "avg"), date, value: r.avg });
            out.push({ seriesId: stationSeriesId(area, f.id, "count"), date, value: r.n });
          }
        }
        return out;
      },
    });
  },
};
