// Données de la carte des stations : un point par station (GeoJSON), son prix pour chaque carburant, un
// drapeau si ce prix n'a pas été mis à jour récemment, et sa variation sur 7 jours quand le relevé
// d'il y a 7 jours existe. Clés courtes : le fichier part tel quel vers le navigateur (environ 9 500 points).
import type { SiteReader } from "../contract.js";
import { addDays } from "../units.js";
import { STATIONS_CATALOG_SETTING, STATIONS_SNAPSHOT, type StationRecord } from "../plugins/stations/index.js";
import { CHANGE_DAYS } from "./departments-page.js";

/** Préfixes des propriétés par carburant : prix, variation, prix ancien. */
export const STATION_PROP = { price: "p_", change: "d_", stale: "o_" } as const;

export type StationFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, string | number>;
};
export type StationsMap = {
  type: "FeatureCollection";
  date: string;
  /** date du relevé comparé, ou null tant que l'historique n'a pas 7 jours */
  compareDate: string | null;
  maxAgeDays: number;
  fuels: { id: string; label: string }[];
  features: StationFeature[];
} | null;

type Catalog = { fuels?: { id: string; label: string }[]; maxAgeDays?: number };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function buildStationsMap(read: SiteReader): StationsMap {
  const catalog = read.settingOrNull(STATIONS_CATALOG_SETTING) as Catalog | null;
  const dates = read.snapshotDates(STATIONS_SNAPSHOT);
  const date = dates.at(-1);
  if (!catalog?.fuels?.length || !date) return null;
  const maxAgeDays = catalog.maxAgeDays ?? 7;
  const compareDate = dates.includes(addDays(date, -CHANGE_DAYS)) ? addDays(date, -CHANGE_DAYS) : null;
  const before = new Map(compareDate ? read.snapshot(STATIONS_SNAPSHOT, compareDate).map((i) => [i.key, i.value as StationRecord]) : []);

  const features = read.snapshot(STATIONS_SNAPSHOT, date).map((item): StationFeature => {
    const st = item.value as StationRecord;
    const props: Record<string, string | number> = { k: item.key, a: st.address, c: st.city, cp: st.cp, h: st.h24 ? 1 : 0 };
    for (const f of catalog.fuels!) {
      const p = st.prices[f.id];
      if (!p) continue;
      props[STATION_PROP.price + f.id] = p.price;
      if (daysBetween(p.updated, date) > maxAgeDays) props[STATION_PROP.stale + f.id] = 1;
      const old = before.get(item.key)?.prices[f.id];
      if (old) props[STATION_PROP.change + f.id] = Math.round((p.price - old.price) * 1000) / 1000;
    }
    return { type: "Feature", geometry: { type: "Point", coordinates: [st.lon, st.lat] }, properties: props };
  });
  return { type: "FeatureCollection", date, compareDate, maxAgeDays, fuels: catalog.fuels, features };
}
