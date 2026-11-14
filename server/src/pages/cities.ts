// Pages par ville : le prix du jour de chaque carburant dans chaque commune qui a au moins une station,
// calculé depuis le relevé des stations (plugin stations). Seuls les prix à jour comptent, comme pour
// nos moyennes nationales. Une ville se repère par son nom ET son département (Saint-Denis existe dans
// plusieurs départements).
import type { SiteReader } from "../contract.js";
import { addDays } from "../units.js";
import { AREA_FRANCE, areaOfDepartment, STATIONS_CATALOG_SETTING, STATIONS_SNAPSHOT, stationSeriesId, type StationRecord } from "../plugins/stations/index.js";
import { STATION_NAMES_SNAPSHOT, type StationName } from "../plugins/station-names/index.js";
import { CHANGE_DAYS } from "./departments-page.js";
import { distanceKm } from "./nearby.js";

/** Chemin des pages par ville. */
export const CITY_PATH = "/prix-carburant";
/** Villes voisines proposées sur chaque page. */
export const NEARBY_CITIES = 8;

/** « Saint-Étienne-du-Rouvray », 76 -> « saint-etienne-du-rouvray-76 » */
export function citySlug(name: string, dep: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${dep.toLowerCase()}`;
}

export type CityStation = { key: string; name: string | null; address: string; h24: boolean; lon: number; lat: number; prices: Record<string, number> };
export type CityFuel = {
  id: string; label: string;
  avg: number; count: number;
  /** la station la moins chère pour ce carburant */
  cheapest: { key: string; price: number };
  /** moyenne de la ville d'il y a 7 jours, différence ; null sans historique */
  change: number | null;
  department: number | null; france: number | null;
};
export type City = {
  slug: string; name: string; dep: string; depLabel: string; cps: string[];
  stations: CityStation[]; fuels: CityFuel[];
  nearby: { slug: string; name: string; km: number }[];
};
export type CitySummary = { slug: string; name: string; dep: string; stations: number };
export type Cities = {
  date: string; compareDate: string | null; maxAgeDays: number;
  departments: { code: string; label: string }[];
  /** par département puis par nom */
  list: CitySummary[];
  bySlug: Map<string, City>;
} | null;

type Catalog = { fuels?: { id: string; label: string }[]; departments?: { code: string; label: string }[]; maxAgeDays?: number };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
// un seul comparateur : localeCompare(…, "fr") en recrée un à chaque appel, très lent sur des milliers de villes
const collator = new Intl.Collator("fr");
const cmpFr = (a: string, b: string) => collator.compare(a, b);

/** prix à jour (mis à jour depuis au plus maxAgeDays jours à `date`) de chaque carburant d'une station */
function freshPrices(st: StationRecord, date: string, maxAgeDays: number, fuels: { id: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fuels) { const p = st.prices[f.id]; if (p && daysBetween(p.updated, date) <= maxAgeDays) out[f.id] = p.price; }
  return out;
}

export function buildCities(read: SiteReader): Cities {
  const catalog = read.settingOrNull(STATIONS_CATALOG_SETTING) as Catalog | null;
  const dates = read.snapshotDates(STATIONS_SNAPSHOT);
  const date = dates.at(-1);
  if (!catalog?.fuels?.length || !date) return null;
  const fuels = catalog.fuels;
  const maxAgeDays = catalog.maxAgeDays ?? 7;
  const depLabel = new Map((catalog.departments ?? []).map((d) => [d.code, d.label]));
  const compareDate = dates.includes(addDays(date, -CHANGE_DAYS)) ? addDays(date, -CHANGE_DAYS) : null;
  const namesDate = read.snapshotDates(STATION_NAMES_SNAPSHOT).at(-1);
  const names = new Map(namesDate ? read.snapshot(STATION_NAMES_SNAPSHOT, namesDate).map((i) => [i.key, (i.value as StationName).name]) : []);

  // regroupement par ville (nom + département) ; une station sans ville ni département n'a pas de page
  const groups = new Map<string, { name: string; dep: string; cps: Set<string>; stations: CityStation[] }>();
  for (const item of read.snapshot(STATIONS_SNAPSHOT, date)) {
    const st = item.value as StationRecord;
    if (!st.city || !st.dep) continue;
    const slug = citySlug(st.city, st.dep);
    const g = groups.get(slug) ?? groups.set(slug, { name: st.city, dep: st.dep, cps: new Set(), stations: [] }).get(slug)!;
    if (st.cp) g.cps.add(st.cp);
    g.stations.push({ key: item.key, name: names.get(item.key) ?? null, address: st.address, h24: st.h24, lon: st.lon, lat: st.lat, prices: freshPrices(st, date, maxAgeDays, fuels) });
  }
  // moyennes de chaque ville il y a 7 jours, même règle de fraîcheur à cette date-là
  const before = new Map<string, Record<string, number[]>>();
  if (compareDate) for (const item of read.snapshot(STATIONS_SNAPSHOT, compareDate)) {
    const st = item.value as StationRecord;
    if (!st.city || !st.dep) continue;
    const acc = before.get(citySlug(st.city, st.dep)) ?? before.set(citySlug(st.city, st.dep), {}).get(citySlug(st.city, st.dep))!;
    for (const [id, p] of Object.entries(freshPrices(st, compareDate, maxAgeDays, fuels))) (acc[id] ??= []).push(p);
  }
  // une lecture par zone et carburant, pas une par ville (des dizaines de milliers de requêtes sinon)
  const lastCache = new Map<string, number | null>();
  const lastAt = (area: string, fuel: string) => {
    const id = stationSeriesId(area, fuel, "avg");
    if (!lastCache.has(id)) { const o = read.get(id).at(-1); lastCache.set(id, o && o.date === date ? o.value : null); }
    return lastCache.get(id)!;
  };

  // centre de chaque ville, et grille d'un quart de degré (les 9 cases autour couvrent une cinquantaine de
  // kilomètres) pour trouver les voisines sans tout comparer à tout
  const centers = [...groups].map(([slug, g]) => ({ slug, name: g.name, lon: mean(g.stations.map((s) => s.lon)), lat: mean(g.stations.map((s) => s.lat)) }));
  const CELLS_PER_DEGREE = 4;
  const cell = (lon: number, lat: number) => `${Math.floor(lon * CELLS_PER_DEGREE)}:${Math.floor(lat * CELLS_PER_DEGREE)}`;
  const grid = new Map<string, typeof centers>();
  for (const c of centers) (grid.get(cell(c.lon, c.lat)) ?? grid.set(cell(c.lon, c.lat), []).get(cell(c.lon, c.lat))!).push(c);
  const nearbyOf = (c: (typeof centers)[number]) => {
    const x = Math.floor(c.lon * CELLS_PER_DEGREE), y = Math.floor(c.lat * CELLS_PER_DEGREE);
    const around: { slug: string; name: string; km: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const o of grid.get(`${x + dx}:${y + dy}`) ?? []) {
      if (o.slug !== c.slug) around.push({ slug: o.slug, name: o.name, km: distanceKm(c.lon, c.lat, o.lon, o.lat) });
    }
    return around.sort((a, b) => a.km - b.km || cmpFr(a.name, b.name)).slice(0, NEARBY_CITIES);
  };

  const bySlug = new Map<string, City>();
  for (const c of centers) {
    const g = groups.get(c.slug)!;
    const cityFuels = fuels.flatMap((f): CityFuel[] => {
      const priced = g.stations.filter((s) => s.prices[f.id] !== undefined);
      if (!priced.length) return [];
      const avg = mean(priced.map((s) => s.prices[f.id]!));
      const best = priced.reduce((a, b) => (b.prices[f.id]! < a.prices[f.id]! ? b : a));
      const old = before.get(c.slug)?.[f.id];
      return [{ id: f.id, label: f.label, avg, count: priced.length, cheapest: { key: best.key, price: best.prices[f.id]! },
        change: old?.length ? avg - mean(old) : null, department: lastAt(areaOfDepartment(g.dep), f.id), france: lastAt(AREA_FRANCE, f.id) }];
    });
    g.stations.sort((a, b) => cmpFr(a.name ?? a.address, b.name ?? b.address));
    bySlug.set(c.slug, { slug: c.slug, name: g.name, dep: g.dep, depLabel: depLabel.get(g.dep) ?? g.dep, cps: [...g.cps].sort(),
      stations: g.stations, fuels: cityFuels, nearby: nearbyOf(c) });
  }
  const list = [...bySlug.values()].map((c) => ({ slug: c.slug, name: c.name, dep: c.dep, stations: c.stations.length }))
    .sort((a, b) => cmpFr(a.dep, b.dep) || cmpFr(a.name, b.name));
  const departments = [...new Set(list.map((c) => c.dep))].map((code) => ({ code, label: depLabel.get(code) ?? code }));
  return { date, compareDate, maxAgeDays, departments, list, bySlug };
}
