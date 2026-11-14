// Lecture des trois formats de source : le CSV de la CRE, le JSON-stat d'Eurostat, la liste Tempo.
// Une colonne ou une dimension se repère par son NOM, déclaré dans electricity.json, jamais par sa position.
import type { Observation } from "../../contract.js";
import type { ElecCatalog, TrvOption } from "./decl.js";
import { EU_PART, euSeriesId, SUBSCRIPTION, TEMPO_SERIES, TRV_PART, trvSeriesId, type EuPart } from "./series-ids.js";

/** « 0,1361 » -> 0.1361 ; cellule vide -> null */
function frNumber(cell: string | undefined): number | null {
  const t = (cell ?? "").trim();
  if (!t) return null;
  const v = Number(t.replace(",", "."));
  if (!Number.isFinite(v)) throw new Error(`CRE : nombre illisible « ${t} »`);
  return v;
}
/** « 01/08/2026 » -> 2026-08-01 */
function frDate(cell: string | undefined): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((cell ?? "").trim());
  if (!m) throw new Error(`CRE : date illisible « ${cell ?? ""} »`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Un fichier de la CRE (une option) : prix HT et TTC de chaque période et de l'abonnement, pour les
 *  puissances suivies. Une ligne sans prix (option pas encore ouverte) est sautée. Deux lignes pour la
 *  même date et la même puissance avec des prix différents : le fichier est incohérent, on refuse. */
export function parseTrvCsv(text: string, option: TrvOption, cat: ElecCatalog): Observation[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const head = (lines[0] ?? "").split(";").map((h) => h.trim());
  const col = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`CRE, option ${option.id} : colonne « ${name} » absente (le format a changé ?)`);
    return i;
  };
  const c = cat.trv.columns;
  const iFrom = col(c.from), iPower = col(c.power);
  const fields: { period: string; part: typeof TRV_PART.ht | typeof TRV_PART.ttc; i: number }[] = [
    { period: SUBSCRIPTION, part: TRV_PART.ht, i: col(c.subscriptionHt) }, { period: SUBSCRIPTION, part: TRV_PART.ttc, i: col(c.subscriptionTtc) },
    ...option.periods.flatMap((p) => [{ period: p.id, part: TRV_PART.ht, i: col(p.ht) }, { period: p.id, part: TRV_PART.ttc, i: col(p.ttc) }]),
  ];
  const seen = new Map<string, number>();
  const out: Observation[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(";");
    const kva = frNumber(cells[iPower]);
    if (kva === null || !cat.trv.powers.includes(kva)) continue;
    const values = fields.map((f) => ({ ...f, v: frNumber(cells[f.i]) }));
    if (values.every((f) => f.v === null)) continue;
    if (values.some((f) => f.v === null || f.v <= 0)) throw new Error(`CRE, option ${option.id} : ligne incomplète « ${line} »`);
    const date = frDate(cells[iFrom]);
    for (const f of values) {
      const seriesId = trvSeriesId(option.id, kva, f.period, f.part);
      const key = `${seriesId}@${date}`;
      const prev = seen.get(key);
      if (prev !== undefined && prev !== f.v) throw new Error(`CRE, option ${option.id} : deux prix différents pour ${seriesId} le ${date}`);
      if (prev === undefined) out.push({ seriesId, date, value: f.v! });
      seen.set(key, f.v!);
    }
  }
  if (!out.length) throw new Error(`CRE, option ${option.id} : aucun tarif pour les puissances ${cat.trv.powers.join(", ")} kVA`);
  return out;
}

/** JSON-stat 2.0 d'Eurostat, aplati : une entrée par valeur, avec le code de chaque dimension. */
export function parseJsonStat(text: string): { coords: Record<string, string>; value: number }[] {
  let d: { id?: string[]; size?: number[]; dimension?: Record<string, { category: { index: Record<string, number> } }>; value?: Record<string, number> };
  try { d = JSON.parse(text); } catch { throw new Error("Eurostat : la réponse n'est pas du JSON"); }
  const { id: ids, size, dimension, value } = d;
  if (!ids || !size || !dimension || !value || ids.length !== size.length) throw new Error("Eurostat : réponse sans les champs JSON-stat attendus");
  const codes = ids.map((k) => {
    const index = dimension[k]?.category.index;
    if (!index) throw new Error(`Eurostat : dimension ${k} sans catégories`);
    const byPos: string[] = [];
    for (const [code, pos] of Object.entries(index)) byPos[pos] = code;
    return byPos;
  });
  return Object.entries(value).map(([flat, v]) => {
    let rest = Number(flat);
    const coords: Record<string, string> = {};
    for (let j = ids.length - 1; j >= 0; j--) {
      coords[ids[j]!] = codes[j]![rest % size[j]!]!;
      rest = Math.floor(rest / size[j]!);
    }
    return { coords, value: v };
  });
}

/** Composantes annuelles (énergie, réseau, taxes TVA comprise, TVA) des pays déclarés, datées du 1er janvier. */
export function parseEuComponents(text: string, cat: ElecCatalog): Observation[] {
  const { parts, band, countries } = cat.eurostat;
  const partOf = new Map<string, EuPart>([[parts.energy, EU_PART.energy], [parts.network, EU_PART.network], [parts.taxesWithVat, EU_PART.taxesWithVat], [parts.vat, EU_PART.vat]]);
  const wanted = new Set(countries.map((c) => c.code));
  const out: Observation[] = [];
  for (const { coords, value } of parseJsonStat(text)) {
    const part = partOf.get(coords.nrg_prc ?? "");
    if (!part || coords.nrg_cons !== band || !wanted.has(coords.geo ?? "") || !/^\d{4}$/.test(coords.time ?? "")) continue;
    out.push({ seriesId: euSeriesId(coords.geo!, part), date: `${coords.time}-01-01`, value });
  }
  if (!out.length) throw new Error("Eurostat : aucune composante pour les pays déclarés (le format a changé ?)");
  return out;
}

/** Prix TTC semestriels (2026-S1 -> 2026-01-01, 2026-S2 -> 2026-07-01) des pays déclarés. */
export function parseEuPrices(text: string, cat: ElecCatalog): Observation[] {
  const { band, totalTax, countries } = cat.eurostat;
  const wanted = new Set(countries.map((c) => c.code));
  const out: Observation[] = [];
  for (const { coords, value } of parseJsonStat(text)) {
    const m = /^(\d{4})-S([12])$/.exec(coords.time ?? "");
    if (!m || coords.nrg_cons !== band || coords.tax !== totalTax || !wanted.has(coords.geo ?? "")) continue;
    out.push({ seriesId: euSeriesId(coords.geo!, EU_PART.price), date: `${m[1]}-${m[2] === "1" ? "01" : "07"}-01`, value });
  }
  if (!out.length) throw new Error("Eurostat : aucun prix semestriel pour les pays déclarés (le format a changé ?)");
  return out;
}

/** Saison Tempo (du 1er du mois déclaré au même jour l'année suivante) qui contient `date` : « 2026-2027 ». */
export function tempoSeason(date: string, startMonth: number): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const from = m >= startMonth ? y : y - 1;
  return `${from}-${from + 1}`;
}

/** Couleur de chaque jour : un code connu de la déclaration, sinon refus. Code 0 = pas encore publiée, sautée. */
export function parseTempo(text: string, cat: ElecCatalog): Observation[] {
  let rows: unknown;
  try { rows = JSON.parse(text); } catch { throw new Error("Tempo : la réponse n'est pas du JSON"); }
  if (!Array.isArray(rows)) throw new Error("Tempo : liste de jours attendue");
  const out: Observation[] = [];
  for (const r of rows as { dateJour?: unknown; codeJour?: unknown }[]) {
    if (r.codeJour === 0) continue;
    if (typeof r.dateJour !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateJour)) throw new Error(`Tempo : date illisible ${JSON.stringify(r)}`);
    if (typeof r.codeJour !== "number" || !cat.tempo.codes[String(r.codeJour)]) throw new Error(`Tempo : code de couleur inconnu ${JSON.stringify(r)}`);
    out.push({ seriesId: TEMPO_SERIES, date: r.dateJour, value: r.codeJour });
  }
  return out;
}
