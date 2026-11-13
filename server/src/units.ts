// Définitions d'unités physiques et de calendrier. Ce ne sont pas des valeurs du produit (elles ne
// changent sur aucune variante) : ce sont des conventions internationales, d'où leur place dans le code.

/** Un baril de pétrole : 42 gallons américains, soit exactement 158,987294928 litres. */
export const LITRES_PER_BARREL = 158.987294928;

/** Les prix du bulletin pétrolier européen sont donnés pour 1 000 litres. */
export const LITRES_PER_BULLETIN_UNIT = 1000;

const MS_PER_DAY = 86_400_000;

/** Origine des dates Excel (système 1900, avec le faux 29 février 1900 d'Excel) : 30 décembre 1899. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Numéro de série Excel -> AAAA-MM-JJ. */
export function excelSerialToIso(serial: number): string {
  return new Date(EXCEL_EPOCH_MS + Math.round(serial) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** AAAA-MM-JJ décalé de `days` jours. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * MS_PER_DAY).toISOString().slice(0, 10);
}
