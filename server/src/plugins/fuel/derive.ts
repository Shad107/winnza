// Décomposition du prix d'un litre. Le bulletin donne le TTC, le HT et le taux de TVA ; le reste se
// calcule, et la méthode est écrite ici pour pouvoir être relue et contestée :
//
//   TTC = (HT + accise) × (1 + TVA)          (la TVA s'applique AUSSI à l'accise)
//   TVA (€/L)    = TTC - TTC / (1 + taux)
//   accise (€/L) = TTC / (1 + taux) - HT     (comprend les éventuelles autres taxes indirectes)
//   brut (€/L)   = Brent ($/baril) / (dollars pour un euro) / 158,987 L, moyenne des 7 jours qui
//                  précèdent le relevé
//   marge (€/L)  = HT - brut                  (raffinage, transport, stockage, distribution)
//
// Limite assumée : un litre de gazole n'est pas un litre de brut (rendement de raffinage, densité).
// Rapporter le baril au litre est la convention des publications grand public (UFIP, ministère).
import type { Observation, SeriesReader } from "../../contract.js";
import { addDays, LITRES_PER_BARREL } from "../../units.js";
import type { FuelCountry, FuelProduct } from "./decl.js";
import { FUEL_PART, fuelSeriesId, OIL_SERIES } from "./series-ids.js";

/** Nombre de jours de cotation du brut moyennés avant chaque relevé hebdomadaire. */
export const CRUDE_LOOKBACK_DAYS = 7;

export function deriveBrentEurPerLitre(read: SeriesReader): Observation[] {
  const fx = new Map(read.get(OIL_SERIES.eurusd).map((o) => [o.date, o.value]));
  const out: Observation[] = [];
  for (const b of read.get(OIL_SERIES.brentUsd)) {
    const usdPerEur = fx.get(b.date);
    if (usdPerEur) out.push({ seriesId: OIL_SERIES.brentEurPerLitre, date: b.date, value: b.value / usdPerEur / LITRES_PER_BARREL });
  }
  return out;
}

/** Brut moyen de la semaine précédant chaque date de relevé (dates prises sur la série de référence). */
export function deriveWeeklyCrude(read: SeriesReader, referenceSeriesId: string): Observation[] {
  const daily = read.get(OIL_SERIES.brentEurPerLitre);
  const out: Observation[] = [];
  let lo = 0;
  for (const { date } of read.get(referenceSeriesId)) {
    const from = addDays(date, -CRUDE_LOOKBACK_DAYS);
    while (lo < daily.length && daily[lo]!.date < from) lo++;
    let sum = 0, n = 0;
    for (let i = lo; i < daily.length && daily[i]!.date < date; i++) { sum += daily[i]!.value; n++; }
    if (n) out.push({ seriesId: OIL_SERIES.brentEurPerLitreWeekly, date, value: sum / n });
  }
  return out;
}

/** Taux en vigueur à une date : dernier changement à cette date ou avant. */
function rateAt(changes: readonly Observation[], date: string): number | null {
  let rate: number | null = null;
  for (const c of changes) { if (c.date <= date) rate = c.value; else break; }
  return rate;
}

export function deriveDecomposition(read: SeriesReader, countries: readonly FuelCountry[], products: readonly FuelProduct[]): Observation[] {
  const crude = new Map(read.get(OIL_SERIES.brentEurPerLitreWeekly).map((o) => [o.date, o.value]));
  const out: Observation[] = [];
  for (const c of countries) for (const p of products) {
    const id = (part: Parameters<typeof fuelSeriesId>[2]) => fuelSeriesId(c.code, p.id, part);
    const ht = new Map(read.get(id(FUEL_PART.ht)).map((o) => [o.date, o.value]));
    const rates = read.get(id(FUEL_PART.vatRate));
    for (const t of read.get(id(FUEL_PART.ttc))) {
      const h = ht.get(t.date);
      const rate = rateAt(rates, t.date);
      if (h === undefined || rate === null) continue;
      const beforeVat = t.value / (1 + rate / 100);
      out.push({ seriesId: id(FUEL_PART.vat), date: t.date, value: t.value - beforeVat });
      out.push({ seriesId: id(FUEL_PART.excise), date: t.date, value: beforeVat - h });
      const k = crude.get(t.date);
      if (k !== undefined) out.push({ seriesId: id(FUEL_PART.margin), date: t.date, value: h - k });
    }
  }
  return out;
}
