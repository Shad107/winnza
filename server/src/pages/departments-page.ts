// Données de la page « prix par département » : la carte (plugin carte) et le prix du jour de chaque
// carburant dans chaque département (plugin stations). Sans l'un des deux plugins, pas de page.
//
// La variation sur 7 jours n'est donnée que si le relevé d'il y a 7 jours existe : la collecte
// quotidienne par département a commencé le 2026-11-13, la variation apparaît donc d'elle-même ensuite.
import type { SiteReader } from "../contract.js";
import { addDays } from "../units.js";
import { MAP_SETTING, parseMapDecl, type MapDecl } from "../plugins/map/index.js";
import { AREA_FRANCE, areaOfDepartment, STATIONS_CATALOG_SETTING, stationSeriesId } from "../plugins/stations/index.js";

/** Écart en jours de la variation affichée. */
export const CHANGE_DAYS = 7;

export type DepartmentPrice = { avg: number; stations: number; change: number | null };
export type DepartmentRow = { code: string; label: string; d: string; prices: Record<string, DepartmentPrice> };
export type DepartmentsPage = {
  fuels: { id: string; label: string; date: string; france: number }[];
  viewBox: MapDecl["viewBox"];
  mapSource: MapDecl["source"];
  departments: DepartmentRow[];
} | null;

type Catalog = { fuels?: { id: string; label: string }[]; departments?: { code: string; label: string }[] };

export function buildDepartmentsPage(read: SiteReader): DepartmentsPage {
  const rawMap = read.settingOrNull(MAP_SETTING);
  const catalog = read.settingOrNull(STATIONS_CATALOG_SETTING) as Catalog | null;
  if (rawMap === null || !catalog?.fuels?.length) return null;
  const map = parseMapDecl(rawMap);

  // pour chaque carburant, le dernier jour relevé en France : tous les départements à cette même date
  const fuels = catalog.fuels.flatMap((f) => {
    const fr = read.get(stationSeriesId(AREA_FRANCE, f.id, "avg")).at(-1);
    return fr ? [{ id: f.id, label: f.label, date: fr.date, france: fr.value }] : [];
  });
  if (!fuels.length) return null;

  const departments = map.shapes.map((s): DepartmentRow => {
    const prices: Record<string, DepartmentPrice> = {};
    for (const f of fuels) {
      const avgs = new Map(read.get(stationSeriesId(areaOfDepartment(s.code), f.id, "avg")).map((o) => [o.date, o.value]));
      const counts = new Map(read.get(stationSeriesId(areaOfDepartment(s.code), f.id, "count")).map((o) => [o.date, o.value]));
      const avg = avgs.get(f.date), stations = counts.get(f.date);
      if (avg === undefined || stations === undefined) continue;   // carburant absent du département ce jour-là
      const before = avgs.get(addDays(f.date, -CHANGE_DAYS));
      prices[f.id] = { avg, stations, change: before === undefined ? null : avg - before };
    }
    return { code: s.code, label: s.label, d: s.d, prices };
  });
  return { fuels, viewBox: map.viewBox, mapSource: map.source, departments };
}
