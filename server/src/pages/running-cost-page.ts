// Données de la page « coût aux 100 km », calculées UNIQUEMENT depuis la base. Une motorisation dont le
// prix n'est pas en base (plugin stations ou électricité éteint) n'apparaît pas ; une motorisation qui
// désigne un carburant ou un tarif que ces plugins ne connaissent pas est une erreur de configuration.
import type { SiteReader } from "../contract.js";
import { parseRunningCost, referenceSeriesId, RUNNING_COST_SETTING, type EnergyUnit, type Link } from "../plugins/running-cost/index.js";
import { AREA_FRANCE, STATIONS_CATALOG_SETTING, stationSeriesId } from "../plugins/stations/index.js";
import { parseElecCatalog } from "../plugins/electricity/decl.js";
import { ELEC_CATALOG_SETTING, TRV_PART, trvSeriesId } from "../plugins/electricity/series-ids.js";

/** D'où vient le prix affiché : il se dit au visiteur. */
export const PRICE_KIND = { pump: "pump", regulated: "regulated", declared: "declared" } as const;
export type PriceKind = (typeof PRICE_KIND)[keyof typeof PRICE_KIND];

export type RunningCostRow = {
  id: string; label: string;
  unit: EnergyUnit;
  /** la consommation de référence dont part celle-ci (le visiteur peut la remplacer par la sienne) */
  consumptionId: string;
  /** consommation de référence aux 100 km, facteur compris */
  consumption: number;
  consumptionLabel: string; consumptionSource: Link;
  factor: { value: number; why: string; source: Link } | null;
  /** euros par litre ou par kWh */
  price: number; priceDate: string; priceKind: PriceKind; priceLabel: string; priceSource: Link | null;
  /** euros aux 100 km, avec la consommation de référence */
  per100: number;
};

export type RunningCostPage = {
  distance: { default: number; min: number; max: number; step: number; source: Link };
  /** consommations de référence aux 100 km, celles qu'au moins une ligne utilise */
  consumptions: { id: string; label: string; unit: EnergyUnit; value: number; source: Link }[];
  /** du moins cher au plus cher, à consommation de référence */
  rows: RunningCostRow[];
};

export function buildRunningCostPage(read: SiteReader): RunningCostPage | null {
  const raw = read.settingOrNull(RUNNING_COST_SETTING);
  if (raw === null) return null;
  const cat = parseRunningCost(raw);
  const stations = read.settingOrNull(STATIONS_CATALOG_SETTING) as { fuels?: { id: string; label: string }[] } | null;
  const elecRaw = read.settingOrNull(ELEC_CATALOG_SETTING);
  const elec = elecRaw === null ? null : parseElecCatalog(elecRaw);

  const rows = cat.vehicles.flatMap((v): RunningCostRow[] => {
    const c = cat.consumptions.find((x) => x.id === v.consumption)!;
    let price: { value: number; date: string; kind: PriceKind; label: string; source: Link | null } | null = null;
    const p = v.price;
    if ("station" in p) {
      if (!stations?.fuels) return [];
      const fuel = stations.fuels.find((f) => f.id === p.station);
      if (!fuel) throw new Error(`coût aux 100 km : ${v.id} désigne le carburant inconnu « ${p.station} »`);
      const last = read.get(stationSeriesId(AREA_FRANCE, fuel.id, "avg")).at(-1);
      if (last) price = { value: last.value, date: last.date, kind: PRICE_KIND.pump, label: `${fuel.label}, prix moyen du jour en station`, source: null };
    } else if ("trv" in p) {
      if (!elec) return [];
      const opt = elec.trv.options.find((o) => o.id === p.trv.option);
      const period = opt?.periods.find((x) => x.id === p.trv.period);
      if (!opt || !period) throw new Error(`coût aux 100 km : ${v.id} désigne le tarif inconnu « ${p.trv.option} / ${p.trv.period} »`);
      const kva = elec.trv.powers[0]!;
      const last = read.get(trvSeriesId(opt.id, kva, period.id, TRV_PART.ttc)).at(-1);
      if (last) price = { value: last.value, date: last.date, kind: PRICE_KIND.regulated, label: `tarif Bleu ${opt.label}, ${period.label.toLowerCase()}, ${kva} kVA`, source: null };
    } else {
      const ref = cat.references.find((r) => r.id === p.reference)!;
      const last = read.get(referenceSeriesId(ref.id)).at(-1);
      if (last) price = { value: last.value, date: last.date, kind: PRICE_KIND.declared, label: ref.label, source: ref.source };
    }
    if (!price) return [];
    const consumption = c.value * (v.factor?.value ?? 1);
    return [{ id: v.id, label: v.label, unit: c.unit, consumptionId: c.id, consumption, consumptionLabel: c.label, consumptionSource: c.source, factor: v.factor,
      price: price.value, priceDate: price.date, priceKind: price.kind, priceLabel: price.label, priceSource: price.source,
      per100: consumption * price.value }];
  });
  if (!rows.length) return null;
  const used = new Set(rows.map((r) => r.consumptionId));
  return { distance: cat.distance, consumptions: cat.consumptions.filter((c) => used.has(c.id)).map(({ id, label, unit, value, source }) => ({ id, label, unit, value, source })),
    rows: rows.sort((a, b) => a.per100 - b.per100) };
}
