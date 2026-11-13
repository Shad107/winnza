// Noms des séries du greffon carburants, construits à un seul endroit : les pages et les ancres
// passent par ces fonctions, jamais par une chaîne recopiée.

/** Une composante du prix d'un litre. */
export const FUEL_PART = {
  /** prix payé à la pompe, toutes taxes comprises (relevé) */
  ttc: "ttc",
  /** prix hors taxes (relevé) */
  ht: "ht",
  /** taux de TVA en vigueur, en % (relevé) */
  vatRate: "vat_rate",
  /** TVA en euros par litre (calculée) */
  vat: "vat",
  /** accise (ex-TICPE) et autres taxes indirectes, en euros par litre (calculée) */
  excise: "excise",
  /** prix hors taxes moins le coût du pétrole brut : raffinage, transport, stockage, distribution (calculé) */
  margin: "margin",
} as const;
export type FuelPart = (typeof FUEL_PART)[keyof typeof FUEL_PART];

export const fuelSeriesId = (country: string, product: string, part: FuelPart): string => `fuel.${country}.${product}.${part}`;

export const OIL_SERIES = {
  brentUsd: "oil.brent.usd_per_barrel",
  eurusd: "fx.eurusd",
  /** coût du pétrole brut ramené au litre, en euros, chaque jour de cotation */
  brentEurPerLitre: "oil.brent.eur_per_litre",
  /** même chose, moyenne de la semaine qui précède chaque relevé du bulletin */
  brentEurPerLitreWeekly: "oil.brent.eur_per_litre.weekly",
} as const;
