// Noms des séries du plugin électricité, construits à un seul endroit : la page passe par ces fonctions,
// jamais par une chaîne recopiée.

/** Réglage en base : le catalogue (options, puissances, pays, règles Tempo), lu par la page. */
export const ELEC_CATALOG_SETTING = "electricity.catalog";

/** Une composante d'un prix du tarif réglementé. */
export const TRV_PART = {
  /** hors taxes (relevé) */
  ht: "ht",
  /** toutes taxes comprises (relevé) */
  ttc: "ttc",
  /** accise sur l'électricité (ex-CSPE et taxes locales), en euros par kWh (calculée) */
  excise: "excise",
  /** TVA en euros par kWh (calculée) */
  vat: "vat",
} as const;
export type TrvPart = (typeof TRV_PART)[keyof typeof TRV_PART];

/** La « période » de l'abonnement, à côté des périodes de consommation (heures creuses, jour rouge...). */
export const SUBSCRIPTION = "subscription";

/** Prix d'une option du tarif Bleu, pour une puissance et une période : `elec.trv.base.6kva.kwh.ttc`. */
export const trvSeriesId = (option: string, kva: number, period: string, part: TrvPart): string => `elec.trv.${option}.${kva}kva.${period}.${part}`;

/** Une part du prix moyen du kWh payé par les ménages (Eurostat). */
export const EU_PART = {
  /** énergie et fourniture (relevé) */
  energy: "energy",
  /** réseau : transport et distribution (relevé) */
  network: "network",
  /** taxes, prélèvements et charges, TVA comprise (relevé) */
  taxesWithVat: "taxes_with_vat",
  /** TVA (relevée) */
  vat: "vat",
  /** taxes hors TVA : taxesWithVat - vat (calculée) ; négative quand une aide publique dépasse les taxes */
  taxes: "taxes",
  /** prix moyen TTC du semestre (relevé) */
  price: "price",
} as const;
export type EuPart = (typeof EU_PART)[keyof typeof EU_PART];

export const euSeriesId = (country: string, part: EuPart): string => `elec.eu.${country}.${part}`;

/** Prix de gros moyen de chaque jour (marché day-ahead), en €/kWh, pour une zone : `elec.wholesale.FR`. */
export const wholesaleSeriesId = (area: string): string => `elec.wholesale.${area}`;

/** Couleur Tempo de chaque jour, sous forme de code (voir la déclaration). */
export const TEMPO_SERIES = "elec.tempo.color";
