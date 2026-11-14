// « Autour de vous » : à partir d'une position (choisie ou acceptée par le visiteur, calculé dans son
// navigateur), les stations proches les moins chères pour un carburant. Seuls les prix à jour comptent.
import { STATION_PROP, type StationFeature } from "./stations-map.js";

export type NearbyStation = { key: string; name: string; address: string; city: string; price: number; km: number; lon: number; lat: number };
export type Nearby = { radiusKm: number; count: number; average: number; cheapest: NearbyStation[]; dearest: number } | null;

const EARTH_KM = 6371;
/** distance à vol d'oiseau, en kilomètres */
export function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

export function nearby(features: readonly StationFeature[], fuelId: string, lon: number, lat: number, radiusKm = 10, n = 5): Nearby {
  const price = STATION_PROP.price + fuelId, stale = STATION_PROP.stale + fuelId;
  const around = features.flatMap((f): NearbyStation[] => {
    const p = f.properties[price];
    if (typeof p !== "number" || f.properties[stale]) return [];
    const [flon, flat] = f.geometry.coordinates;
    const km = distanceKm(lon, lat, flon, flat);
    return km <= radiusKm ? [{ key: String(f.properties.k), name: String(f.properties.n ?? ""), address: String(f.properties.a ?? ""), city: String(f.properties.c ?? ""), price: p, km, lon: flon, lat: flat }] : [];
  });
  if (!around.length) return null;
  // à prix égal, la plus proche d'abord
  const sorted = [...around].sort((a, b) => a.price - b.price || a.km - b.km);
  return { radiusKm, count: around.length, average: around.reduce((s, x) => s + x.price, 0) / around.length,
    cheapest: sorted.slice(0, n), dearest: sorted.at(-1)!.price };
}
