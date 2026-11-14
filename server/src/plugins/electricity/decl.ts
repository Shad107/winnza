// Lecture et contrôle de declarations/electricity.json. Un champ manquant est une erreur à la saisie ou
// au démarrage de la collecte, pas un « undefined » qui se propage jusqu'à l'écran.
import type { SourceDecl } from "../../contract.js";

/** Couleur d'un jour Tempo. Les codes de la source (1, 2, 3) sont reliés à ces noms par la déclaration. */
export const TEMPO_COLOR = { blue: "blue", white: "white", red: "red" } as const;
export type TempoColor = (typeof TEMPO_COLOR)[keyof typeof TEMPO_COLOR];
const TEMPO_COLORS: readonly TempoColor[] = Object.values(TEMPO_COLOR);

/** Les sources que le plugin connaît, par rôle. */
export const ELEC_SOURCE = {
  trvBase: "trvBase", trvHphc: "trvHphc", trvTempo: "trvTempo",
  components: "components", prices: "prices", tempo: "tempo",
} as const;
export type ElecSourceKey = (typeof ELEC_SOURCE)[keyof typeof ELEC_SOURCE];
const TRV_SOURCES: readonly ElecSourceKey[] = [ELEC_SOURCE.trvBase, ELEC_SOURCE.trvHphc, ELEC_SOURCE.trvTempo];

/** Les rubriques Eurostat que le plugin lit, par rôle. */
export const EU_RUBRIC = { energy: "energy", network: "network", taxesWithVat: "taxesWithVat", vat: "vat" } as const;
export type EuRubric = (typeof EU_RUBRIC)[keyof typeof EU_RUBRIC];

export type TrvPeriod = { id: string; label: string; ht: string; ttc: string; tempo?: TempoColor };
export type TrvOption = { id: string; label: string; source: ElecSourceKey; periods: TrvPeriod[] };
export type Link = { name: string; url: string };

export type ElecCatalog = {
  trv: {
    columns: { from: string; power: string; subscriptionHt: string; subscriptionTtc: string };
    powers: number[];
    kwhVat: { rate: number; source: Link };
    plausibleExcise: { min: number; max: number };
    options: TrvOption[];
  };
  eurostat: {
    band: string; bandLabel: string;
    parts: Record<EuRubric, string>;
    totalTax: string;
    check: { tolerance: number; minAgreement: number };
    reference: string;
    countries: { code: string; label: string }[];
  };
  tempo: {
    codes: Record<string, TempoColor>;
    seasonStartMonth: number;
    quota: { white: number; red: number };
    quotaSource: Link;
  };
  page: { consumption: { default: number; min: number; max: number; step: number } };
};
export type ElecDecl = ElecCatalog & { sources: Record<ElecSourceKey, SourceDecl> };

type Obj = Record<string, unknown>;
const fail = (where: string, what: string): never => { throw new Error(`electricity.json, ${where} : ${what}`); };
const obj = (o: unknown, where: string): Obj =>
  (o && typeof o === "object" && !Array.isArray(o) ? (o as Obj) : fail(where, "objet attendu"));
const str = (o: Obj, k: string, where: string): string =>
  (typeof o[k] === "string" && o[k] ? (o[k] as string) : fail(where, `« ${k} » manquant`));
const num = (o: Obj, k: string, where: string): number =>
  (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : fail(where, `« ${k} » doit être un nombre`));
const list = (o: unknown, where: string): unknown[] => (Array.isArray(o) && o.length ? o : fail(where, "liste non vide attendue"));
const link = (o: unknown, where: string): Link => { const l = obj(o, where); return { name: str(l, "name", where), url: str(l, "url", where) }; };
function unique(ids: string[], where: string): void {
  const seen = new Set<string>();
  for (const id of ids) { if (seen.has(id)) fail(where, `identifiant en double « ${id} »`); seen.add(id); }
}
/** un identifiant entre dans un nom de série : lettres, chiffres, tirets */
const ID_RE = /^[a-z0-9-]+$/;
const id = (o: Obj, where: string): string => { const v = str(o, "id", where); return ID_RE.test(v) ? v : fail(where, `identifiant invalide « ${v} »`); };

function source(o: unknown, where: string): SourceDecl {
  const s = obj(o, where);
  return { id: str(s, "id", where), name: str(s, "name", where), publisher: str(s, "publisher", where), url: str(s, "url", where), licence: str(s, "licence", where) };
}

/** Le catalogue (tout sauf les sources) : lu par le plugin dans ses réglages, et par la page en base. */
export function parseElecCatalog(json: unknown): ElecCatalog {
  const root = obj(json, "racine");
  const t = obj(root.trv, "trv");
  const cols = obj(t.columns, "trv.columns");
  const vat = obj(t.kwhVat, "trv.kwhVat");
  const rate = num(vat, "rate", "trv.kwhVat");
  if (rate <= 0 || rate >= 1) fail("trv.kwhVat", "le taux s'écrit en fraction (0,2 pour 20 %)");
  const pe = obj(t.plausibleExcise, "trv.plausibleExcise");
  const options = list(t.options, "trv.options").map((x, i): TrvOption => {
    const w = `trv.options[${i}]`, o = obj(x, w);
    const srcName = str(o, "source", w);
    const src = TRV_SOURCES.find((k) => k === srcName) ?? fail(w, `source inconnue « ${srcName} »`);
    const periods = list(o.periods, `${w}.periods`).map((y, j): TrvPeriod => {
      const wp = `${w}.periods[${j}]`, p = obj(y, wp);
      const tempo = p.tempo === undefined ? undefined : TEMPO_COLORS.find((c) => c === p.tempo) ?? fail(wp, `couleur Tempo inconnue « ${String(p.tempo)} »`);
      return { id: id(p, wp), label: str(p, "label", wp), ht: str(p, "ht", wp), ttc: str(p, "ttc", wp), ...(tempo ? { tempo } : {}) };
    });
    unique(periods.map((p) => p.id), `${w}.periods`);
    return { id: id(o, w), label: str(o, "label", w), source: src, periods };
  });
  unique(options.map((o) => o.id), "trv.options");
  const powers = list(t.powers, "trv.powers").map((p) => (typeof p === "number" && Number.isInteger(p) && p > 0 ? p : fail("trv.powers", "puissances en kVA entières attendues")));

  const e = obj(root.eurostat, "eurostat");
  const parts = obj(e.parts, "eurostat.parts");
  const check = obj(e.check, "eurostat.check");
  const minAgreement = num(check, "minAgreement", "eurostat.check");
  if (minAgreement <= 0 || minAgreement > 1) fail("eurostat.check", "minAgreement est une fraction, de 0 à 1");
  const countries = list(e.countries, "eurostat.countries").map((x, i) => { const c = obj(x, `eurostat.countries[${i}]`); return { code: str(c, "code", `eurostat.countries[${i}]`), label: str(c, "label", `eurostat.countries[${i}]`) }; });
  unique(countries.map((c) => c.code), "eurostat.countries");
  const reference = str(e, "reference", "eurostat");
  if (!countries.some((c) => c.code === reference)) fail("eurostat", `le pays de référence ${reference} n'est pas dans la liste`);

  const tp = obj(root.tempo, "tempo");
  const codes: Record<string, TempoColor> = {};
  for (const [k, v] of Object.entries(obj(tp.codes, "tempo.codes"))) codes[k] = TEMPO_COLORS.find((c) => c === v) ?? fail("tempo.codes", `couleur inconnue « ${String(v)} » pour le code ${k}`);
  const quota = obj(tp.quota, "tempo.quota");
  const startMonth = num(tp, "seasonStartMonth", "tempo");
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) fail("tempo", "seasonStartMonth : un mois, de 1 à 12");

  const c = obj(obj(root.page, "page").consumption, "page.consumption");
  const consumption = { default: num(c, "default", "page.consumption"), min: num(c, "min", "page.consumption"), max: num(c, "max", "page.consumption"), step: num(c, "step", "page.consumption") };
  if (!(consumption.min < consumption.max && consumption.default >= consumption.min && consumption.default <= consumption.max)) fail("page.consumption", "il faut min < max et la valeur par défaut entre les deux");
  // hors de la grille du curseur, le navigateur arrondit en silence et affiche une autre consommation
  const steps = (consumption.default - consumption.min) / consumption.step;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) fail("page.consumption", "la valeur par défaut doit tomber sur un pas du curseur (min + n × step)");

  return {
    trv: {
      columns: { from: str(cols, "from", "trv.columns"), power: str(cols, "power", "trv.columns"), subscriptionHt: str(cols, "subscriptionHt", "trv.columns"), subscriptionTtc: str(cols, "subscriptionTtc", "trv.columns") },
      powers, kwhVat: { rate, source: link(vat.source, "trv.kwhVat.source") },
      plausibleExcise: { min: num(pe, "min", "trv.plausibleExcise"), max: num(pe, "max", "trv.plausibleExcise") },
      options,
    },
    eurostat: {
      band: str(e, "band", "eurostat"), bandLabel: str(e, "bandLabel", "eurostat"),
      parts: { energy: str(parts, EU_RUBRIC.energy, "eurostat.parts"), network: str(parts, EU_RUBRIC.network, "eurostat.parts"),
        taxesWithVat: str(parts, EU_RUBRIC.taxesWithVat, "eurostat.parts"), vat: str(parts, EU_RUBRIC.vat, "eurostat.parts") } satisfies Record<EuRubric, string>,
      totalTax: str(e, "totalTax", "eurostat"),
      check: { tolerance: num(check, "tolerance", "eurostat.check"), minAgreement },
      reference, countries,
    },
    tempo: {
      codes, seasonStartMonth: startMonth,
      quota: { white: num(quota, "white", "tempo.quota"), red: num(quota, "red", "tempo.quota") },
      quotaSource: link(tp.quotaSource, "tempo.quotaSource"),
    },
    page: { consumption },
  };
}

export function parseElecDecl(json: unknown): ElecDecl {
  const src = obj(obj(json, "racine").sources, "sources");
  const one = (k: ElecSourceKey) => source(src[k], `sources.${k}`);
  const sources = { trvBase: one(ELEC_SOURCE.trvBase), trvHphc: one(ELEC_SOURCE.trvHphc), trvTempo: one(ELEC_SOURCE.trvTempo),
    components: one(ELEC_SOURCE.components), prices: one(ELEC_SOURCE.prices), tempo: one(ELEC_SOURCE.tempo) } satisfies Record<ElecSourceKey, SourceDecl>;
  return { ...parseElecCatalog(json), sources };
}
