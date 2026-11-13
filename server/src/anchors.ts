// Points d'ancrage : des valeurs PUBLIÉES par un tiers (presse, organisme officiel) que nos séries
// doivent retrouver. Si une série s'en écarte, la collecte échoue au lieu d'afficher un chiffre faux.
// Les ancres se déclarent dans declarations/anchors.json, chacune avec sa source.
import type { SeriesReader } from "./contract.js";

/** Comment comparer la série à la valeur publiée, sur l'intervalle [from, to]. */
export const AGGREGATE = {
  mean: "mean",
  max: "max",
  /** Valeur en vigueur à la date `from` (dernière observation à cette date ou avant) : taux, tarifs. */
  inForce: "inForce",
} as const;
export type Aggregate = (typeof AGGREGATE)[keyof typeof AGGREGATE];

export type Anchor = {
  seriesId: string;
  from: string;
  to: string;
  aggregate: Aggregate;
  expected: number;
  tolerance: number;
  publishedBy: string;
  url: string;
  note?: string;
};

export type AnchorResult = { anchor: Anchor; actual: number | null; ok: boolean };

export function isAggregate(x: unknown): x is Aggregate {
  return Object.values(AGGREGATE).includes(x as Aggregate);
}

function measure(read: SeriesReader, a: Anchor): number | null {
  const obs = read.get(a.seriesId);
  if (a.aggregate === AGGREGATE.inForce) {
    const before = obs.filter((o) => o.date <= a.from);
    return before.length ? before[before.length - 1]!.value : null;
  }
  const inRange = obs.filter((o) => o.date >= a.from && o.date <= a.to).map((o) => o.value);
  if (!inRange.length) return null;
  return a.aggregate === AGGREGATE.max
    ? inRange.reduce((m, v) => (v > m ? v : m), -Infinity)   // pas de Math.max(...) : la pile déborde sur une longue série
    : inRange.reduce((s, v) => s + v, 0) / inRange.length;
}

export function checkAnchors(read: SeriesReader, anchors: readonly Anchor[]): AnchorResult[] {
  return anchors.map((anchor) => {
    const actual = measure(read, anchor);
    return { anchor, actual, ok: actual !== null && Math.abs(actual - anchor.expected) <= anchor.tolerance };
  });
}

/** Lit et vérifie le fichier de déclaration : une ancre mal formée est une erreur, pas une ancre ignorée. */
export function parseAnchors(json: unknown): Anchor[] {
  if (!Array.isArray(json)) throw new Error("anchors.json : un tableau est attendu");
  return json.map((a: Record<string, unknown>, i) => {
    const s = (k: string) => { if (typeof a[k] !== "string" || !a[k]) throw new Error(`ancre ${i} : « ${k} » manquant`); return a[k] as string; };
    const n = (k: string) => { if (typeof a[k] !== "number") throw new Error(`ancre ${i} : « ${k} » doit être un nombre`); return a[k] as number; };
    if (!isAggregate(a.aggregate)) throw new Error(`ancre ${i} : agrégat inconnu « ${String(a.aggregate)} »`);
    return { seriesId: s("seriesId"), from: s("from"), to: s("to"), aggregate: a.aggregate, expected: n("expected"),
      tolerance: n("tolerance"), publishedBy: s("publishedBy"), url: s("url"),
      ...(typeof a.note === "string" ? { note: a.note } : {}) };
  });
}
