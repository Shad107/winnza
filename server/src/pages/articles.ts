// Les analyses (« le point de la semaine ») : des textes datés, écrits par l'IA du site, dont AUCUN chiffre
// n'est tapé à la main. Un chiffre s'écrit par un jeton de données, remplacé à l'affichage par la valeur de la
// base à la date indiquée :
//
//   {{station.FR.gazole.avg@2026-11-16|eur3}}          la valeur en vigueur à cette date
//   {{station.FR.gazole.avg@2026-11-09..2026-11-16|ct}}  l'écart entre deux dates
//
// Le fichier : content/analyses/AAAA-MM-JJ-sujet.md, avec un en-tête entre deux lignes « --- »
// (title, description, date). `checkArticle` refuse tout ce qui contredit ces règles : la CI le lance sur
// chaque article du dépôt.
import type { Observation, SeriesReader } from "../contract.js";

/** Comment écrire une valeur : euros au centime, au millième, au dix-millième, dollars entiers. */
export const VALUE_FORMAT = { eur2: "eur2", eur3: "eur3", eur4: "eur4", usd0: "usd0" } as const;
/** Comment écrire un écart entre deux dates : en centimes, ou en pourcentage. */
export const DELTA_FORMAT = { ct: "ct", pct: "pct" } as const;
type ValueFormat = (typeof VALUE_FORMAT)[keyof typeof VALUE_FORMAT];
type DeltaFormat = (typeof DELTA_FORMAT)[keyof typeof DELTA_FORMAT];
const VALUE_FORMATS: readonly string[] = Object.values(VALUE_FORMAT);
const DELTA_FORMATS: readonly string[] = Object.values(DELTA_FORMAT);

export const TOKEN = /\{\{([A-Za-z0-9._-]+)@(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?\|([a-z0-9]+)\}\}/g;
/** Un nombre tapé à la main : décimal, ou suivi d'une unité (€, %, $, ct, centimes, euros, dollars, MWh, kWh). */
const HAND_NUMBER = /\d+[,.]\d+|\d+\s*(?:€|%|\$|ct\b|centimes?\b|euros?\b|dollars?\b|[MkG]Wh\b)/i;

export type Article = { slug: string; title: string; description: string; date: string; body: string };

/** Lit un fichier d'analyse : en-tête, puis corps. Une erreur dit ce qui manque, avec le nom du fichier. */
export function parseArticle(slug: string, raw: string): Article {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`analyse ${slug} : en-tête « --- » absent`);
  const head: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) head[kv[1]!] = kv[2]!.replace(/^"(.*)"$/, "$1");
  }
  const need = (k: string) => head[k] || (() => { throw new Error(`analyse ${slug} : « ${k} » manquant dans l'en-tête`); })();
  return { slug, title: need("title"), description: need("description"), date: need("date"), body: m[2]!.trim() };
}

/** Les règles d'une analyse ; chacune rend une phrase lisible quand elle échoue. */
export function checkArticle(a: Article): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(a.slug)) problems.push("nom de fichier : AAAA-MM-JJ-sujet.md, en minuscules");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !a.slug.startsWith(a.date)) problems.push("date : AAAA-MM-JJ, la même que le début du nom de fichier");
  if (a.title.length > 70) problems.push(`titre de ${a.title.length} caractères (au plus 70)`);
  if (a.description.length > 160) problems.push(`description de ${a.description.length} caractères (au plus 160)`);
  if (/[\u2013\u2014]/.test(a.title + a.description + a.body)) problems.push("tiret cadratin ou demi-cadratin");
  if (/<[a-z/!]/i.test(a.body)) problems.push("HTML brut dans le corps : le Markdown suffit");
  // les jetons : bien formés, format connu, dates dans l'ordre et pas après l'article
  for (const t of a.body.matchAll(TOKEN)) {
    const [, , from, to, format] = t;
    if (to ? !DELTA_FORMATS.includes(format!) : !VALUE_FORMATS.includes(format!)) problems.push(`jeton ${t[0]} : format « ${format} » inconnu ou inadapté`);
    if (to && to <= from!) problems.push(`jeton ${t[0]} : dates dans le désordre`);
    if ((to ?? from!) > a.date) problems.push(`jeton ${t[0]} : date après celle de l'article`);
  }
  const rest = a.body.replace(TOKEN, "").replace(/\{\{[^}]*\}\}/g, (bad) => { problems.push(`jeton mal formé : ${bad}`); return ""; });
  const hand = HAND_NUMBER.exec(rest);
  if (hand) problems.push(`chiffre écrit à la main : « ${hand[0]} » (utiliser un jeton de données)`);
  return problems;
}

const fr = (digits: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
const FORMAT_VALUE = {
  eur2: (v: number) => fr(2).format(v), eur3: (v: number) => fr(3).format(v), eur4: (v: number) => fr(4).format(v),
  usd0: (v: number) => `${Math.round(v).toLocaleString("fr-FR")} $`,
} satisfies Record<ValueFormat, (v: number) => string>;
const FORMAT_DELTA = {
  ct: (a: number, b: number) => { const c = Math.round((b - a) * 100); return `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c)} centime${Math.abs(c) > 1 ? "s" : ""}`; },
  pct: (a: number, b: number) => { const p = Math.round(((b - a) / a) * 100); return `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)} %`; },
} satisfies Record<DeltaFormat, (a: number, b: number) => string>;

const VALUE = new Map<string, (v: number) => string>(Object.entries(FORMAT_VALUE));
const DELTA = new Map<string, (a: number, b: number) => string>(Object.entries(FORMAT_DELTA));

/** Valeur en vigueur à une date : la dernière observation à cette date ou avant. */
function at(obs: Observation[], date: string): number | null {
  let v: number | null = null;
  for (const o of obs) { if (o.date > date) break; v = o.value; }
  return v;
}

/** Remplace chaque jeton par la valeur de la base. Une donnée absente s'écrit « (donnée indisponible) » et
 *  figure dans `missing`, pour que l'état du site le signale. */
export function resolveArticle(a: Article, read: SeriesReader): { markdown: string; missing: string[] } {
  const missing: string[] = [];
  const markdown = a.body.replace(TOKEN, (whole, id: string, from: string, to: string | undefined, format: string) => {
    const obs = read.get(id);
    const v1 = at(obs, from), v2 = to ? at(obs, to) : null;
    const delta = DELTA.get(format), value = VALUE.get(format);
    if (v1 === null || (to && v2 === null) || (to ? !delta : !value)) { missing.push(whole); return "(donnée indisponible)"; }
    return to ? delta!(v1, v2!) : value!(v1);
  });
  return { markdown, missing };
}
