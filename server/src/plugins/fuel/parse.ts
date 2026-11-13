// Lecture des trois sources du greffon carburants. Fonctions pures (octets ou texte -> observations),
// testées sur des extraits réels dans test-fixtures/.
//
// Ce module EST la connaissance du format de chaque source (noms de feuilles, codes de colonnes) : si
// la Commission change son classeur, c'est ici qu'on l'adapte, et les tests le diront.
import type { Observation } from "../../contract.js";
import { excelSerialToIso, LITRES_PER_BULLETIN_UNIT } from "../../units.js";
import type { Workbook } from "../../xlsx.js";
import type { FuelCountry, FuelProduct } from "./decl.js";
import { FUEL_PART, fuelSeriesId, OIL_SERIES } from "./series-ids.js";

export const BULLETIN_SHEET = { withTax: "Prices with taxes", withoutTax: "Prices wo taxes", vat: "VAT" } as const;

/** Code de colonne du bulletin, ex. « FR_price_with_tax_diesel ». */
const priceColumnCode = (country: string, withTax: boolean, bulletinCode: string) =>
  `${country}_price_${withTax ? "with" : "wo"}_tax_${bulletinCode}`;

function sheet(book: Workbook, name: string) {
  const rows = book.get(name);
  if (!rows) throw new Error(`bulletin pétrolier : feuille « ${name} » absente (format changé ?)`);
  return rows;
}

/** Prix TTC ou HT, toutes les semaines depuis 2005, pour chaque pays et produit déclarés. */
export function parseBulletinPrices(book: Workbook, withTax: boolean, countries: readonly FuelCountry[], products: readonly FuelProduct[]): Observation[] {
  const rows = sheet(book, withTax ? BULLETIN_SHEET.withTax : BULLETIN_SHEET.withoutTax);
  const header = rows[0];
  if (!header) throw new Error("bulletin pétrolier : feuille vide");
  const colOf = new Map<string, string>();
  for (const [col, v] of header) if (typeof v === "string") colOf.set(v.trim(), col);

  const part = withTax ? FUEL_PART.ttc : FUEL_PART.ht;
  const out: Observation[] = [];
  for (const c of countries) for (const p of products) {
    const code = priceColumnCode(c.code, withTax, p.bulletinCode);
    const col = colOf.get(code);
    if (!col) throw new Error(`bulletin pétrolier : colonne « ${code} » absente (format changé ?)`);
    const seriesId = fuelSeriesId(c.code, p.id, part);
    for (const row of rows) {
      const serial = row.get("A");
      const value = row.get(col);
      // une ligne de données commence par une date Excel ; les en-têtes et la note de bas de page non
      if (typeof serial !== "number" || typeof value !== "number" || value <= 0) continue;
      out.push({ seriesId, date: excelSerialToIso(serial), value: value / LITRES_PER_BULLETIN_UNIT });
    }
  }
  return out;
}

/** Taux de TVA : un bloc par pays (code « FR_ » en colonne A sur sa première ligne), une ligne par
 *  changement de taux, « en vigueur depuis » en colonne B. */
export function parseBulletinVat(book: Workbook, countries: readonly FuelCountry[], products: readonly FuelProduct[]): Observation[] {
  const rows = sheet(book, BULLETIN_SHEET.vat);
  const labelRow = rows.find((r) => [...r.values()].some((v) => typeof v === "string" && v.trim().startsWith("Since")));
  if (!labelRow) throw new Error("bulletin pétrolier, TVA : ligne d'en-tête « Since: » absente");
  const colOfProduct = new Map<string, string>();
  for (const p of products) {
    const hit = [...labelRow].find(([, v]) => typeof v === "string" && v.trim().startsWith(p.vatColumnLabel));
    if (!hit) throw new Error(`bulletin pétrolier, TVA : colonne « ${p.vatColumnLabel} » absente`);
    colOfProduct.set(p.id, hit[0]);
  }
  const wanted = new Set(countries.map((c) => c.code));
  const out: Observation[] = [];
  let current: string | null = null;
  for (const row of rows) {
    const a = row.get("A");
    if (typeof a === "string" && /^[A-Z]{2,3}_$/.test(a.trim())) current = a.trim().slice(0, -1);
    const since = row.get("B");
    if (!current || !wanted.has(current) || typeof since !== "number") continue;
    for (const p of products) {
      const rate = row.get(colOfProduct.get(p.id)!);
      if (typeof rate !== "number") continue;
      out.push({ seriesId: fuelSeriesId(current, p.id, FUEL_PART.vatRate), date: excelSerialToIso(since), value: rate });
    }
  }
  return out;
}

/** FRED : « observation_date,DCOILBRENTEU », un point (« . ») ou un vide les jours sans cotation. */
export function parseFredCsv(text: string, seriesId: string = OIL_SERIES.brentUsd): Observation[] {
  const out: Observation[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [date, v] = line.split(",");
    if (!date || !v || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = Number(v);
    if (Number.isFinite(value) && value > 0) out.push({ seriesId, date, value });
  }
  return out;
}

/** BCE : CSV SDMX, colonnes repérées par leur nom (TIME_PERIOD, OBS_VALUE), pas par leur position. */
export function parseEcbCsv(text: string, seriesId: string = OIL_SERIES.eurusd): Observation[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = (lines[0] ?? "").split(",");
  const iDate = head.indexOf("TIME_PERIOD");
  const iVal = head.indexOf("OBS_VALUE");
  if (iDate < 0 || iVal < 0) throw new Error("BCE : colonnes TIME_PERIOD / OBS_VALUE absentes");
  const out: Observation[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    const date = f[iDate];
    const value = Number(f[iVal]);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0) out.push({ seriesId, date, value });
  }
  return out;
}
