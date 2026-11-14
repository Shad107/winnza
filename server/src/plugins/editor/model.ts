// Le modèle de l'IA rédactrice, SANS le SDK : types, lecture de la déclaration, lecture d'une page,
// contrôles des propositions, dépense du mois et titres validés. Le site public lit ce fichier ; seul le
// plugin (index.ts, lancé par la collecte) charge le SDK d'Anthropic.
import type { CollectReader, SourceDecl } from "../../contract.js";

/** Ce que devient une proposition qui passe les contrôles : publiée seule, ou en attente de validation. */
export const PUBLISH = { auto: "auto", review: "review" } as const;
export type Publish = (typeof PUBLISH)[keyof typeof PUBLISH];
const PUBLISH_MODES: readonly Publish[] = Object.values(PUBLISH);

export type EditorDecl = {
  source: SourceDecl;
  publish: Publish;
  api: { keySecret: string; model: string; effort: "low" | "medium" | "high"; maxTokens: number };
  pricing: { inputUsdPerMTok: number; outputUsdPerMTok: number; asOf: string; source: { name: string; url: string } };
  budget: { monthlyUsd: number; everyDays: number };
  site: string; brand: string;
  limits: { title: number; description: number; share: number };
  keywordsPerPage: number; keepDays: number;
};

/** Ce qu'une page montre aujourd'hui aux moteurs. */
export type PageNow = { title: string; description: string; h1: string; intro: string };
/** Une proposition de l'IA, avec ce que les contrôles y ont trouvé (vide : publiable après validation). */
export type Proposal = {
  path: string; label: string;
  current: { title: string; description: string };
  /** shareText : l'accroche de l'image de partage (absente des propositions antérieures au 2026-11-14) */
  proposed: { title: string; description: string; shareText?: string };
  keywords: string[]; reason: string;
  problems: string[];
  runId: string;
};
/** Une exécution : ce qu'elle a coûté, pour tenir le budget. */
export type EditorRun = { runId: string; date: string; model: string; inputTokens: number; outputTokens: number; costUsd: number };

export const EDITOR_SNAPSHOT = "editor.proposals";
/** Titres et descriptions validés par un humain : { chemin : { title, description, approvedOn } }. */
export const EDITOR_OVERRIDES_SETTING = "editor.overrides";
/** Clé de l'élément d'instantané qui décrit l'exécution (les autres sont des chemins de page). */
export const RUN_KEY = "_run";
export const EDITOR_PLUGIN_ID = "editor";
/** Réglage écrit par le plugin : le mode de publication, lu par le site. */
export const EDITOR_PUBLISH_SETTING = "editor.publish";
/** Pages bloquées dans l'administration : elles gardent leur titre d'origine, quoi que propose l'IA. */
export const EDITOR_BLOCKED_SETTING = "editor.blocked";

const EFFORTS = ["low", "medium", "high"] as const;
type Obj = Record<string, unknown>;
const fail = (where: string, what: string): never => { throw new Error(`editor.json, ${where} : ${what}`); };
const obj = (o: unknown, where: string): Obj => (o && typeof o === "object" && !Array.isArray(o) ? (o as Obj) : fail(where, "objet attendu"));
const str = (o: Obj, k: string, where: string): string => (typeof o[k] === "string" && o[k] ? (o[k] as string) : fail(where, `« ${k} » manquant`));
const pos = (o: Obj, k: string, where: string): number => (typeof o[k] === "number" && (o[k] as number) > 0 ? (o[k] as number) : fail(where, `« ${k} » : nombre positif attendu`));
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/;

export function parseEditorDecl(json: unknown): EditorDecl {
  const root = obj(json, "racine");
  const s = obj(root.source, "source"), a = obj(root.api, "api"), p = obj(root.pricing, "pricing"), b = obj(root.budget, "budget"), l = obj(root.limits, "limits");
  const keySecret = str(a, "keySecret", "api");
  if (!SECRET_NAME.test(keySecret)) fail("api", "keySecret doit être un NOM de variable (majuscules), jamais la clé");
  const effort = EFFORTS.find((e) => e === a.effort) ?? fail("api", `effort inconnu « ${String(a.effort)} »`);
  const site = str(root, "site", "racine");
  if (!/^https:\/\/[^/]+$/.test(site)) fail("racine", "site : une adresse https sans chemin ni / final");
  const ps = obj(p.source, "pricing.source");
  const publish = PUBLISH_MODES.find((m) => m === root.publish) ?? fail("racine", `publish : « auto » ou « review », pas « ${String(root.publish)} »`);
  return {
    publish,
    source: { id: str(s, "id", "source"), name: str(s, "name", "source"), publisher: str(s, "publisher", "source"), url: str(s, "url", "source"), licence: str(s, "licence", "source") },
    api: { keySecret, model: str(a, "model", "api"), effort, maxTokens: pos(a, "maxTokens", "api") },
    pricing: { inputUsdPerMTok: pos(p, "inputUsdPerMTok", "pricing"), outputUsdPerMTok: pos(p, "outputUsdPerMTok", "pricing"), asOf: str(p, "asOf", "pricing"),
      source: { name: str(ps, "name", "pricing.source"), url: str(ps, "url", "pricing.source") } },
    budget: { monthlyUsd: pos(b, "monthlyUsd", "budget"), everyDays: pos(b, "everyDays", "budget") },
    site, brand: str(root, "brand", "racine"),
    limits: { title: pos(l, "title", "limits"), description: pos(l, "description", "limits"), share: pos(l, "share", "limits") },
    keywordsPerPage: pos(root, "keywordsPerPage", "racine"), keepDays: pos(root, "keepDays", "racine"),
  };
}

const ENTITY: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ", "#160": " " };
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&(#?\w+);/g, (m, e: string) => ENTITY[e] ?? m).replace(/\s+/g, " ").trim();
/** Titre, description, titre visible et introduction d'une page rendue par le serveur. */
export function readPage(html: string): PageNow {
  const pick = (re: RegExp) => text(re.exec(html)?.[1] ?? "");
  const title = pick(/<title>([\s\S]*?)<\/title>/);
  if (!title) throw new Error("page sans <title> : rendu changé ?");
  return { title, description: pick(/<meta name="description" content="([^"]*)"/), h1: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/), intro: pick(/<p class="intro[^"]*"[^>]*>([\s\S]*?)<\/p>/) };
}

/** Les contrôles d'une proposition. Chacun rend une phrase lisible quand il échoue. */
export function checkProposal(p: { title: string; description: string; shareText?: string }, now: PageNow, decl: EditorDecl): string[] {
  const problems: string[] = [];
  if (p.title.length > decl.limits.title) problems.push(`titre de ${p.title.length} caractères (au plus ${decl.limits.title})`);
  if (p.description.length > decl.limits.description) problems.push(`description de ${p.description.length} caractères (au plus ${decl.limits.description})`);
  if (p.description.length < 50) problems.push("description trop courte");
  if (p.shareText !== undefined && p.shareText.length > decl.limits.share) problems.push(`accroche de ${p.shareText.length} caractères (au plus ${decl.limits.share})`);
  if (/[\u2013\u2014]/.test(p.title + p.description + (p.shareText ?? ""))) problems.push("tiret cadratin ou demi-cadratin");
  if ((p.title + " " + (p.shareText ?? "")).toLowerCase().includes(decl.brand.toLowerCase())) problems.push(`le nom ${decl.brand} est ajouté par le site, pas dans le titre`);
  // un nombre que la page ne porte pas est inventé (les prix changent chaque jour : la page les écrit elle-même).
  // Les chiffres collés à des lettres sont des noms (SP95, E10, E85), pas des nombres.
  const known = `${now.title} ${now.description} ${now.h1} ${now.intro}`;
  const NUMBER = /(?<![\p{L}\d])\d+(?:[,.]\d+)?(?![\p{L}\d])/gu;
  for (const n of new Set((p.title + " " + p.description + " " + (p.shareText ?? "")).match(NUMBER) ?? [])) if (!known.includes(n)) problems.push(`chiffre « ${n} » absent de la page`);
  return problems;
}

/** Dépense déjà engagée ce mois-ci (un passage compté une fois, même s'il est recopié les jours suivants). */
export function spentThisMonth(read: CollectReader, today: string): number {
  const runs = new Map<string, number>();
  for (const d of read.snapshotDates(EDITOR_SNAPSHOT)) {
    const run = read.snapshot(EDITOR_SNAPSHOT, d).find((i) => i.key === RUN_KEY)?.value as EditorRun | undefined;
    if (run && run.date.slice(0, 7) === today.slice(0, 7)) runs.set(run.runId, run.costUsd);
  }
  return [...runs.values()].reduce((s, v) => s + v, 0);
}

/** Titre et description validés pour une page (sans le nom du site, ajouté à l'affichage). */
export type Override = { title: string; description: string; approvedOn: string; shareText?: string };
/** Les titres validés, lus en base : une valeur mal formée est une erreur, jamais un titre vide en ligne. */
export function parseOverrides(json: unknown): Record<string, Override> {
  if (json === null || json === undefined) return {};
  const root = obj(json, "editor.overrides");
  const out: Record<string, Override> = {};
  for (const [path, v] of Object.entries(root)) {
    if (!path.startsWith("/")) throw new Error(`editor.overrides : chemin invalide « ${path} »`);
    const o = obj(v, `editor.overrides[${path}]`);
    out[path] = { title: str(o, "title", path), description: str(o, "description", path), approvedOn: str(o, "approvedOn", path),
      ...(typeof o.shareText === "string" && o.shareText ? { shareText: o.shareText } : {}) };
  }
  return out;
}

/** Pages bloquées, lues en base. */
export function parseBlocked(json: unknown): string[] {
  if (json === null || json === undefined) return [];
  if (!Array.isArray(json)) throw new Error("editor.blocked : liste de chemins attendue");
  return json.map((p) => (typeof p === "string" && p.startsWith("/") ? p : (() => { throw new Error(`editor.blocked : chemin invalide « ${String(p)} »`); })()));
}

/** Les titres réellement en ligne : ceux validés à la main, puis, en mode automatique, chaque proposition du
 *  dernier passage qui a passé tous les contrôles. Une page bloquée garde son titre d'origine. */
export function liveOverrides(read: CollectReader): Record<string, Override> {
  const blocked = new Set(parseBlocked(read.settingOrNull(EDITOR_BLOCKED_SETTING)));
  const manual = parseOverrides(read.settingOrNull(EDITOR_OVERRIDES_SETTING));
  const out: Record<string, Override> = {};
  if (read.settingOrNull(EDITOR_PUBLISH_SETTING) === PUBLISH.auto) {
    const date = read.snapshotDates(EDITOR_SNAPSHOT).at(-1);
    const items = date ? read.snapshot(EDITOR_SNAPSHOT, date) : [];
    const run = items.find((i) => i.key === RUN_KEY)?.value as EditorRun | undefined;
    for (const i of items) {
      if (i.key === RUN_KEY) continue;
      const p = i.value as Proposal;
      if (!p.problems.length && run) out[p.path] = { title: p.proposed.title, description: p.proposed.description, approvedOn: run.date,
        ...(p.proposed.shareText ? { shareText: p.proposed.shareText } : {}) };
    }
  }
  for (const [path, o] of Object.entries(manual)) out[path] = o;
  for (const path of blocked) delete out[path];
  return out;
}
