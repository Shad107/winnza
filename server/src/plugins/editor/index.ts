// Plugin « rédaction par IA » : Claude relit chaque page telle qu'elle est en ligne, avec les recherches
// réelles qui la concernent (plugin mots-clés), et PROPOSE un titre et une description pour les moteurs.
// Rien n'est publié sans validation humaine (/admin/ia). Chaque proposition passe des contrôles qui savent
// échouer : longueur, aucun chiffre inventé, aucun tiret cadratin, pas de nom de marque en double.
//
// Source d'APPOINT : sans clé, sans budget ou sans réponse, la collecte continue et garde les dernières
// propositions. Le budget mensuel est un plafond dur, compté sur la dépense réelle de chaque appel.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PLUGIN_CATEGORY, type CollectContext, type CollectReader, type Plugin, type SnapshotItem, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { addDays, parisDate } from "../../units.js";
import { KEYWORDS_SETTING, KEYWORDS_SNAPSHOT, type KeywordGroup, type KeywordIdea } from "../keywords/index.js";

export type EditorDecl = {
  source: SourceDecl;
  api: { keySecret: string; model: string; effort: "low" | "medium" | "high"; maxTokens: number };
  pricing: { inputUsdPerMTok: number; outputUsdPerMTok: number; asOf: string; source: { name: string; url: string } };
  budget: { monthlyUsd: number; everyDays: number };
  site: string; brand: string;
  limits: { title: number; description: number };
  keywordsPerPage: number; keepDays: number;
};

/** Ce qu'une page montre aujourd'hui aux moteurs. */
export type PageNow = { title: string; description: string; h1: string; intro: string };
/** Une proposition de l'IA, avec ce que les contrôles y ont trouvé (vide : publiable après validation). */
export type Proposal = {
  path: string; label: string;
  current: { title: string; description: string };
  proposed: { title: string; description: string };
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
  return {
    source: { id: str(s, "id", "source"), name: str(s, "name", "source"), publisher: str(s, "publisher", "source"), url: str(s, "url", "source"), licence: str(s, "licence", "source") },
    api: { keySecret, model: str(a, "model", "api"), effort, maxTokens: pos(a, "maxTokens", "api") },
    pricing: { inputUsdPerMTok: pos(p, "inputUsdPerMTok", "pricing"), outputUsdPerMTok: pos(p, "outputUsdPerMTok", "pricing"), asOf: str(p, "asOf", "pricing"),
      source: { name: str(ps, "name", "pricing.source"), url: str(ps, "url", "pricing.source") } },
    budget: { monthlyUsd: pos(b, "monthlyUsd", "budget"), everyDays: pos(b, "everyDays", "budget") },
    site, brand: str(root, "brand", "racine"),
    limits: { title: pos(l, "title", "limits"), description: pos(l, "description", "limits") },
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
export function checkProposal(p: { title: string; description: string }, now: PageNow, decl: EditorDecl): string[] {
  const problems: string[] = [];
  if (p.title.length > decl.limits.title) problems.push(`titre de ${p.title.length} caractères (au plus ${decl.limits.title})`);
  if (p.description.length > decl.limits.description) problems.push(`description de ${p.description.length} caractères (au plus ${decl.limits.description})`);
  if (p.description.length < 50) problems.push("description trop courte");
  if (/[–—]/.test(p.title + p.description)) problems.push("tiret cadratin ou demi-cadratin");
  if (p.title.toLowerCase().includes(decl.brand.toLowerCase())) problems.push(`le nom ${decl.brand} est ajouté par le site, pas dans le titre`);
  // un nombre que la page ne porte pas est inventé (les prix changent chaque jour : la page les écrit elle-même).
  // Les chiffres collés à des lettres sont des noms (SP95, E10, E85), pas des nombres.
  const known = `${now.title} ${now.description} ${now.h1} ${now.intro}`;
  const NUMBER = /(?<![\p{L}\d])\d+(?:[,.]\d+)?(?![\p{L}\d])/gu;
  for (const n of new Set((p.title + " " + p.description).match(NUMBER) ?? [])) if (!known.includes(n)) problems.push(`chiffre « ${n} » absent de la page`);
  return problems;
}

const ProposalsSchema = z.object({
  proposals: z.array(z.object({
    path: z.string(), title: z.string(), description: z.string(),
    keywords: z.array(z.string()), reason: z.string(),
  })),
});

/** Les consignes, avec les limites de la déclaration (sans elles, l'IA dépassait toutes les longueurs : mesuré le 2026-11-14). */
const system = (decl: EditorDecl) => `${SYSTEM}
Longueurs maximales, espaces compris, à respecter strictement : titre ${decl.limits.title} caractères, description ${decl.limits.description} caractères (c'est ce que les moteurs affichent ; au-delà, le texte est coupé). Une description fait au moins 50 caractères.`;

const SYSTEM = `Tu rédiges, en français, le titre et la description que les moteurs de recherche affichent pour chaque page d'un site d'information grand public sur le prix de l'énergie (carburant, électricité).
Pour chaque page, tu reçois ce qu'elle montre aujourd'hui (titre, description, titre visible, introduction) et les recherches que les gens tapent vraiment, avec leur volume mensuel.
Règles :
- reprendre les formulations les plus cherchées qui correspondent VRAIMENT au contenu de la page ; ne jamais promettre ce que la page ne contient pas ;
- aucun chiffre qui ne figure pas déjà dans ce que la page montre : les prix changent chaque jour, la page les écrit elle-même ;
- pas le nom du site dans le titre : il est ajouté automatiquement ;
- pas de tiret cadratin ni demi-cadratin ; ton factuel, sans superlatif publicitaire ni point d'exclamation ;
- si le titre actuel est déjà le meilleur, le reproposer tel quel et le dire dans la raison.
Pour chaque page, donne le chemin exact reçu, le titre, la description, les recherches visées, et une raison courte.`;

/** fetch pour le SDK, branché sur le contexte de collecte : même chemin réseau que les autres sources, et testable. */
function fetchVia(ctx: CollectContext): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if ((init?.method ?? "GET").toUpperCase() !== "POST") throw new Error(`IA : seules les requêtes POST passent (${url})`);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v; });
    const body = typeof init?.body === "string" ? init.body : init?.body ? await new Response(init.body).text() : "";
    return new Response(await ctx.postText(url, body, headers), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
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

export const editorPlugin: Plugin = {
  id: EDITOR_PLUGIN_ID,
  title: { fr: "Rédaction par IA", en: "AI editor" },
  description: { fr: "Chaque semaine, Claude propose pour chaque page un titre et une description tirés des recherches réelles. Rien n'est publié sans validation.",
    en: "Every week, Claude proposes a title and description for each page from real searches. Nothing is published without approval." },
  category: PLUGIN_CATEGORY.site,
  settings: jsonSettings(parseEditorDecl, { fr: "Modèle, tarif, budget mensuel (plafond dur), rythme, limites de longueur, et NOM de la variable du serveur qui porte la clé. Pris en compte à la prochaine collecte.",
    en: "Model, pricing, monthly budget (hard cap), cadence, length limits, and NAME of the server variable holding the key. Applied at the next collection." }),
  register(api) {
    const decl = parseEditorDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSnapshot({ id: EDITOR_SNAPSHOT, label: "Propositions de titres et descriptions par l'IA", sourceId: decl.source.id, keepDays: decl.keepDays, optional: true });
    api.registerSnapshotCollector({ id: "editor.proposals", snapshot: EDITOR_SNAPSHOT, run: async (ctx, read) => {
      const today = parisDate();
      const lastDate = read.snapshotDates(EDITOR_SNAPSHOT).at(-1);
      const last = lastDate ? read.snapshot(EDITOR_SNAPSHOT, lastDate) : [];
      // entre deux passages, on recopie les propositions telles quelles : rien n'est dépensé. On compte depuis
      // la date de l'EXÉCUTION, pas celle de l'instantané (recopié chaque jour, il serait toujours récent)
      const lastRun = last.find((i) => i.key === RUN_KEY)?.value as EditorRun | undefined;
      if (lastRun && last.some((i) => i.key !== RUN_KEY) && addDays(lastRun.date, decl.budget.everyDays) > today) return { date: today, items: last };
      const spent = spentThisMonth(read, today);
      if (spent >= decl.budget.monthlyUsd) throw new Error(`IA : budget du mois atteint (${spent.toFixed(2)} $ sur ${decl.budget.monthlyUsd} $)`);
      const key = ctx.secret(decl.api.keySecret);
      if (!key) throw new Error(`IA : variable ${decl.api.keySecret} absente sur le serveur`);

      // les pages, telles qu'elles sont en ligne, et les recherches qui les concernent
      const groups = (read.settingOrNull(KEYWORDS_SETTING) as KeywordGroup[] | null) ?? [];
      const kwDate = read.snapshotDates(KEYWORDS_SNAPSHOT).at(-1);
      if (!groups.length || !kwDate) throw new Error("IA : pas encore de mots-clés relevés (plugin mots-clés)");
      const ideas = read.snapshot(KEYWORDS_SNAPSHOT, kwDate).map((i) => i.value as KeywordIdea);
      const pages = [];
      for (const g of groups) {
        const now = readPage(await ctx.fetchText(decl.site + g.page));
        const searches = ideas.filter((i) => i.group === g.id).sort((a, b) => b.volume - a.volume).slice(0, decl.keywordsPerPage).map((i) => `${i.text} (${i.volume})`);
        pages.push({ path: g.page, label: g.label, now, searches });
      }

      const client = new Anthropic({ apiKey: key, fetch: fetchVia(ctx), maxRetries: 0 });
      const response = await client.beta.messages.parse({
        model: decl.api.model, max_tokens: decl.api.maxTokens,
        betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
        output_config: { effort: decl.api.effort, format: betaZodOutputFormat(ProposalsSchema) },
        system: system(decl),
        messages: [{ role: "user", content: JSON.stringify(pages.map((p) => ({ chemin: p.path, sujet: p.label, aujourdhui: p.now, recherches: p.searches }))) }],
      });
      if (response.stop_reason === "refusal") throw new Error(`IA : refus du modèle (${response.stop_details?.category ?? "sans catégorie"})`);
      const parsed = response.parsed_output;
      if (!parsed) throw new Error(`IA : réponse illisible (arrêt : ${response.stop_reason})`);

      const runId = `${today}-${response.id}`;
      const run: EditorRun = { runId, date: today, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        costUsd: (response.usage.input_tokens * decl.pricing.inputUsdPerMTok + response.usage.output_tokens * decl.pricing.outputUsdPerMTok) / 1_000_000 };
      const items: SnapshotItem[] = [{ key: RUN_KEY, value: run }];
      for (const page of pages) {
        const p = parsed.proposals.find((x) => x.path === page.path);
        if (!p) continue;   // une page oubliée par l'IA n'a pas de proposition cette semaine
        const proposal: Proposal = { path: page.path, label: page.label, current: { title: page.now.title, description: page.now.description },
          proposed: { title: p.title.trim(), description: p.description.trim() }, keywords: p.keywords, reason: p.reason,
          problems: checkProposal({ title: p.title.trim(), description: p.description.trim() }, page.now, decl), runId };
        items.push({ key: page.path, value: proposal });
      }
      return { date: today, items };
    } });
  },
};

/** Titre et description validés pour une page (sans le nom du site, ajouté à l'affichage). */
export type Override = { title: string; description: string; approvedOn: string };
/** Les titres validés, lus en base : une valeur mal formée est une erreur, jamais un titre vide en ligne. */
export function parseOverrides(json: unknown): Record<string, Override> {
  if (json === null || json === undefined) return {};
  const root = obj(json, "editor.overrides");
  const out: Record<string, Override> = {};
  for (const [path, v] of Object.entries(root)) {
    if (!path.startsWith("/")) throw new Error(`editor.overrides : chemin invalide « ${path} »`);
    const o = obj(v, `editor.overrides[${path}]`);
    out[path] = { title: str(o, "title", path), description: str(o, "description", path), approvedOn: str(o, "approvedOn", path) };
  }
  return out;
}
