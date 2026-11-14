// L'image de partage d'une page (réseaux sociaux) : un chiffre clé du jour, tiré de la base. Le texte
// d'accroche vient de l'IA rédactrice (plugin editor), contrôlé comme les titres ; à défaut, le titre.
import type { SiteReader } from "../contract.js";
import { AREA_FRANCE, stationSeriesId } from "../plugins/stations/index.js";
import { OIL_SERIES } from "../plugins/fuel/series-ids.js";
import { ELEC_CATALOG_SETTING, TRV_PART, trvSeriesId } from "../plugins/electricity/series-ids.js";
import { parseElecCatalog } from "../plugins/electricity/decl.js";
import { buildRunningCostPage } from "./running-cost-page.js";

/** L'unité du chiffre clé, pour l'écrire correctement. */
export const SHARE_UNIT = { eurPerLitre: "eurPerLitre", eurPerKwh: "eurPerKwh", usd: "usd", eur: "eur" } as const;
export type ShareUnit = (typeof SHARE_UNIT)[keyof typeof SHARE_UNIT];
export type ShareFigure = { value: number; unit: ShareUnit; label: string; date: string };

/** Le carburant de référence des pages carburant (le plus vendu en France). */
export const SHARE_FUEL = "gazole";
const FUEL_PATHS = ["/", "/carte-des-stations", "/prix-par-departement", "/prevision", "/prix-carburant", "/taxes", "/historique", "/europe"];

export function shareFigure(path: string, read: SiteReader): ShareFigure | null {
  if (FUEL_PATHS.includes(path)) {
    const o = read.get(stationSeriesId(AREA_FRANCE, SHARE_FUEL, "avg")).at(-1);
    return o ? { value: o.value, unit: SHARE_UNIT.eurPerLitre, label: "le litre de gazole en moyenne aujourd'hui", date: o.date } : null;
  }
  if (path === "/prix-du-baril") {
    const o = read.get(OIL_SERIES.brentUsd).at(-1);
    return o ? { value: o.value, unit: SHARE_UNIT.usd, label: "le baril de Brent", date: o.date } : null;
  }
  if (path === "/electricite") {
    const raw = read.settingOrNull(ELEC_CATALOG_SETTING);
    if (raw === null) return null;
    const c = parseElecCatalog(raw);
    const o = read.get(trvSeriesId(c.page.compareWith.option, c.trv.powers[0]!, c.page.compareWith.period, TRV_PART.ttc)).at(-1);
    return o ? { value: o.value, unit: SHARE_UNIT.eurPerKwh, label: "le kWh au tarif réglementé", date: o.date } : null;
  }
  if (path === "/cout-aux-100-km") {
    const page = buildRunningCostPage(read);
    const best = page?.rows[0];
    if (!page || !best) return null;
    // la date des prix la plus récente de la page, pas celle d'entrée en vigueur du tarif le moins cher
    const date = page.rows.map((r) => r.priceDate).sort().at(-1)!;
    const label = best.label.charAt(0).toLowerCase() + best.label.slice(1);   // « Électrique, … Tempo » : seule l'initiale baisse
    return { value: best.per100, unit: SHARE_UNIT.eur, label: `les 100 km, le moins cher : ${label}`, date };
  }
  return null;
}
