// Calculs d'affichage partagés par les pages : passer du litre au plein, et choisir le texte à
// imprimer dans les barres. Une seule définition pour toutes les pages.
import { LITRE_PARTS, PART_META, type LitrePart } from './parts.ts';
import { money, percent } from './format.ts';

export type Parts = Record<LitrePart, number>;

/** Une part en dessous de cette fraction de la barre n'imprime pas son montant (il serait coupé). */
const MIN_SHARE_FOR_AMOUNT = 0.13;
const MIN_SHARE_FOR_PERCENT = 0.09;

export const sum = (b: Parts): number => LITRE_PARTS.reduce((s, k) => s + b[k], 0);
export const scaled = (b: Parts, k: number): Parts => Object.fromEntries(LITRE_PARTS.map((key) => [key, b[key] * k])) as Parts;
const each = (f: (key: LitrePart) => string): Record<LitrePart, string> => Object.fromEntries(LITRE_PARTS.map((key) => [key, f(key)])) as Record<LitrePart, string>;

/** montant dans chaque part assez large ; `width` : largeur de la barre (0 à 1) quand on compare deux barres */
export const fitText = (v: Parts, whole: number, perLitre: boolean, width = 1) =>
  each((key) => ((v[key] / whole) * width > MIN_SHARE_FOR_AMOUNT ? money(v[key], perLitre) : ''));
export const allText = (v: Parts, perLitre: boolean) => each((key) => money(v[key], perLitre));
export const shareText = (v: Parts, whole: number) => each((key) => (v[key] / whole > MIN_SHARE_FOR_PERCENT ? percent(v[key], whole) : ''));
export const describe = (v: Parts, prefix: string, perLitre: boolean) =>
  `${prefix} : ${LITRE_PARTS.map((key) => `${PART_META[key].short} ${money(v[key], perLitre)}`).join(', ')}`;

/** taux de TVA déduit des données (TVA / prix avant TVA), jamais écrit à la main */
export const vatRateOf = (litre: number, vat: number): number => vat / (litre - vat);
