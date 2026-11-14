// Ce qui se calcule à partir des relevés, après la collecte.
import type { Observation, SeriesReader } from "../../contract.js";
import type { ElecCatalog } from "./decl.js";
import { EU_PART, euSeriesId, TRV_PART, trvSeriesId } from "./series-ids.js";

/** Accise et TVA de chaque prix au kWh du tarif réglementé, à partir du HT et du TTC relevés :
 *  TTC = (HT + accise) × (1 + TVA), donc accise = TTC / (1 + TVA) - HT. Une accise hors des bornes
 *  plausibles veut dire que les colonnes ou le taux sont faux : on refuse plutôt que d'afficher. */
export function deriveTrvTaxes(read: SeriesReader, cat: ElecCatalog): Observation[] {
  const { rate } = cat.trv.kwhVat;
  const { min, max } = cat.trv.plausibleExcise;
  const out: Observation[] = [];
  for (const o of cat.trv.options) for (const kva of cat.trv.powers) for (const p of o.periods) {
    const ht = new Map(read.get(trvSeriesId(o.id, kva, p.id, TRV_PART.ht)).map((x) => [x.date, x.value]));
    for (const { date, value: ttc } of read.get(trvSeriesId(o.id, kva, p.id, TRV_PART.ttc))) {
      const h = ht.get(date);
      if (h === undefined) throw new Error(`électricité : prix TTC sans prix HT pour ${o.id} ${kva} kVA ${p.id} le ${date}`);
      const beforeVat = ttc / (1 + rate);
      const excise = beforeVat - h;
      if (excise < min || excise > max) {
        throw new Error(`électricité : accise de ${excise.toFixed(4)} €/kWh pour ${o.id} ${kva} kVA ${p.id} le ${date}, hors des bornes ${min} à ${max} (colonnes HT et TTC inversées, ou taux de TVA faux ?)`);
      }
      out.push({ seriesId: trvSeriesId(o.id, kva, p.id, TRV_PART.excise), date, value: excise });
      out.push({ seriesId: trvSeriesId(o.id, kva, p.id, TRV_PART.vat), date, value: ttc - beforeVat });
    }
  }
  return out;
}

/** Taxes hors TVA de chaque pays et chaque année. Chez Eurostat, la rubrique « taxes » contient déjà la
 *  TVA : on le VÉRIFIE avant de soustraire. Énergie + réseau + taxes doit retomber sur la moyenne des deux
 *  semestres TTC pour la plupart des couples pays-année (la moyenne annuelle d'Eurostat est pondérée par
 *  les volumes, d'où quelques écarts isolés). Si la TVA était à part, presque aucun ne collerait. */
export function deriveEuTaxes(read: SeriesReader, cat: ElecCatalog): Observation[] {
  const { tolerance, minAgreement } = cat.eurostat.check;
  const out: Observation[] = [];
  let compared = 0, agreed = 0;
  for (const { code } of cat.eurostat.countries) {
    const by = (part: Parameters<typeof euSeriesId>[1]) => new Map(read.get(euSeriesId(code, part)).map((o) => [o.date, o.value]));
    const energy = by(EU_PART.energy), network = by(EU_PART.network), vat = by(EU_PART.vat);
    const prices = read.get(euSeriesId(code, EU_PART.price));
    for (const { date, value: withVat } of read.get(euSeriesId(code, EU_PART.taxesWithVat))) {
      const v = vat.get(date), e = energy.get(date), n = network.get(date);
      if (v === undefined) continue;
      out.push({ seriesId: euSeriesId(code, EU_PART.taxes), date, value: withVat - v });
      const year = prices.filter((p) => p.date.startsWith(date.slice(0, 4)));
      if (e === undefined || n === undefined || year.length !== 2) continue;
      compared++;
      if (Math.abs(e + n + withVat - (year[0]!.value + year[1]!.value) / 2) <= tolerance) agreed++;
    }
  }
  if (!compared) throw new Error("électricité : aucune année où comparer les composantes Eurostat au prix TTC");
  if (agreed / compared < minAgreement) {
    throw new Error(`électricité : énergie + réseau + taxes ne retombe sur le prix TTC que dans ${agreed} cas sur ${compared} ; la lecture des rubriques Eurostat est à revoir`);
  }
  return out;
}
