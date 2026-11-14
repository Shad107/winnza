// Mise en forme des montants, à la française. Un seul endroit : toutes les pages passent par ici.
const cents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dateLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** 2,18 € */
export const eur2 = (v: number): string => cents.format(v);
const kwh = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4, maximumFractionDigits: 4 });
/** 0,2001 € : le prix du kWh se publie au dix-millième d'euro */
export const eur4 = (v: number): string => kwh.format(v);
/** 109 € */
export const eur0 = (v: number): string => whole.format(v);
/** au centime pour un litre, à l'euro pour un plein */
export const money = (v: number, perLitre: boolean): string => (perLitre ? eur2(v) : eur0(v));
export const signed = (v: number, perLitre: boolean): string => (v >= 0 ? '+' : '−') + money(Math.abs(v), perLitre);
/** espace fine insécable avant « % » : le nombre et son signe ne se séparent jamais en fin de ligne */
export const NBSP_PERCENT = ' %';
export const percent = (part: number, whole_: number): string => `${Math.round((part / whole_) * 100)}${NBSP_PERCENT}`;
/** 2026-11-09 -> 9 novembre 2026 */
export const longDate = (iso: string): string => dateLong.format(new Date(iso + 'T00:00:00Z')).replace(/^1 /, '1er ');
