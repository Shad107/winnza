// Plugin « mots-clés » : ce que les gens tapent vraiment dans Google, par page du site (Keyword Planner,
// API Google Ads). Ces chiffres orientent les titres, les questions fréquentes et les pages à créer ; ils
// ne sont pas publiés tels quels (page d'administration, et l'IA du site plus tard).
//
// Source d'APPOINT : le jeton Google expire tous les 7 jours tant que l'écran de consentement du projet
// Cloud est en mode Test. Une expiration n'arrête pas la collecte, elle est signalée et le dernier relevé
// valable reste en base.
import { PLUGIN_CATEGORY, type CollectContext, type Plugin, type SnapshotItem, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { parisDate } from "../../units.js";

export type KeywordGroup = { id: string; page: string; label: string; seeds: string[] };
export type KeywordsDecl = {
  source: SourceDecl;
  api: {
    tokenUrl: string; ideasUrl: string; geo: string; language: string; network: string;
    secrets: { customerId: string; clientId: string; clientSecret: string; refreshToken: string };
  };
  keepDays: number; perGroup: number;
  groups: KeywordGroup[];
};
/** Une idée de mot-clé : volume moyen, concurrence publicitaire, et les 12 derniers mois. */
export type KeywordIdea = { group: string; text: string; volume: number; competition: string; seed: boolean; months: { month: string; searches: number }[] };

export const KEYWORDS_SNAPSHOT = "keywords.ideas";
export const KEYWORDS_SETTING = "keywords.groups";

type Obj = Record<string, unknown>;
const fail = (where: string, what: string): never => { throw new Error(`keywords.json, ${where} : ${what}`); };
const obj = (o: unknown, where: string): Obj => (o && typeof o === "object" && !Array.isArray(o) ? (o as Obj) : fail(where, "objet attendu"));
const str = (o: Obj, k: string, where: string): string => (typeof o[k] === "string" && o[k] ? (o[k] as string) : fail(where, `« ${k} » manquant`));
const int = (o: Obj, k: string, where: string): number => (Number.isInteger(o[k]) && (o[k] as number) > 0 ? (o[k] as number) : fail(where, `« ${k} » : entier positif attendu`));
/** nom d'une variable d'environnement, pas une valeur collée par erreur */
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/;

export function parseKeywordsDecl(json: unknown): KeywordsDecl {
  const root = obj(json, "racine");
  const s = obj(root.source, "source");
  const a = obj(root.api, "api");
  const sec = obj(a.secrets, "api.secrets");
  const secret = (k: string) => { const v = str(sec, k, "api.secrets"); return SECRET_NAME.test(v) ? v : fail("api.secrets", `« ${k} » doit être un NOM de variable (majuscules), jamais la valeur`); };
  const ideasUrl = str(a, "ideasUrl", "api");
  if (!ideasUrl.includes("{customer}")) fail("api", "ideasUrl doit contenir {customer}");
  const groups = (Array.isArray(root.groups) && root.groups.length ? root.groups : fail("groups", "liste non vide attendue")).map((x, i): KeywordGroup => {
    const w = `groups[${i}]`, g = obj(x, w);
    const page = str(g, "page", w);
    if (!page.startsWith("/")) fail(w, "page : un chemin du site, qui commence par /");
    const seeds = Array.isArray(g.seeds) && g.seeds.length && g.seeds.every((t) => typeof t === "string" && t.trim()) ? (g.seeds as string[]) : fail(w, "seeds : liste de mots-clés non vide");
    return { id: str(g, "id", w), page, label: str(g, "label", w), seeds };
  });
  const seen = new Set<string>();
  for (const g of groups) { if (seen.has(g.id)) fail("groups", `identifiant en double « ${g.id} »`); seen.add(g.id); }
  return {
    source: { id: str(s, "id", "source"), name: str(s, "name", "source"), publisher: str(s, "publisher", "source"), url: str(s, "url", "source"), licence: str(s, "licence", "source") },
    api: { tokenUrl: str(a, "tokenUrl", "api"), ideasUrl, geo: str(a, "geo", "api"), language: str(a, "language", "api"), network: str(a, "network", "api"),
      secrets: { customerId: secret("customerId"), clientId: secret("clientId"), clientSecret: secret("clientSecret"), refreshToken: secret("refreshToken") } },
    keepDays: int(root, "keepDays", "racine"), perGroup: int(root, "perGroup", "racine"), groups,
  };
}

/** Mois de l'API Google Ads (énumération MonthOfYear) -> numéro. */
const MONTH_OF_YEAR: Readonly<Record<string, number>> = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

/** Réponse de generateKeywordIdeas -> idées triées par volume décroissant, `limit` au plus. */
export function parseIdeas(text: string, group: KeywordGroup, limit: number): KeywordIdea[] {
  let r: { results?: { text?: string; keywordIdeaMetrics?: { avgMonthlySearches?: string | number; competition?: string; monthlySearchVolumes?: { month?: string; year?: string | number; monthlySearches?: string | number }[] } }[] };
  try { r = JSON.parse(text); } catch { throw new Error("Keyword Planner : la réponse n'est pas du JSON"); }
  if (!Array.isArray(r.results)) throw new Error("Keyword Planner : réponse sans « results » (format changé ?)");
  const seeds = new Set(group.seeds.map((s) => s.toLowerCase()));
  return r.results.flatMap((x): KeywordIdea[] => {
    const t = x.text?.trim();
    if (!t) return [];
    const m = x.keywordIdeaMetrics ?? {};
    const months = (m.monthlySearchVolumes ?? []).flatMap((v) => {
      const n = MONTH_OF_YEAR[v.month ?? ""];
      if (!n || v.year === undefined) return [];
      return [{ month: `${v.year}-${String(n).padStart(2, "0")}`, searches: Number(v.monthlySearches ?? 0) }];
    });
    return [{ group: group.id, text: t, volume: Number(m.avgMonthlySearches ?? 0), competition: m.competition ?? "UNSPECIFIED", seed: seeds.has(t.toLowerCase()), months }];
  }).sort((a, b) => b.volume - a.volume || a.text.localeCompare(b.text))
    // la même idée en double (casse différente) ferait refuser l'instantané : on garde la première
    .filter((idea, i, all) => all.findIndex((o) => o.text.toLowerCase() === idea.text.toLowerCase()) === i)
    .slice(0, limit);
}

/** Jeton d'accès OAuth, à partir des secrets du serveur. Le message d'erreur nomme la variable, jamais sa valeur. */
async function accessToken(ctx: CollectContext, decl: KeywordsDecl): Promise<{ token: string; customer: string }> {
  const need = (name: string) => ctx.secret(name) ?? (() => { throw new Error(`Keyword Planner : variable ${name} absente sur le serveur`); })();
  const s = decl.api.secrets;
  const customer = need(s.customerId).replaceAll("-", "");
  const body = new URLSearchParams({ client_id: need(s.clientId), client_secret: need(s.clientSecret), refresh_token: need(s.refreshToken), grant_type: "refresh_token" }).toString();
  let res: { access_token?: string };
  try { res = JSON.parse(await ctx.postText(decl.api.tokenUrl, body, { "content-type": "application/x-www-form-urlencoded" })); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // invalid_grant : le jeton de rafraîchissement a expiré (mode Test, 7 jours) ; il faut réautoriser
    throw new Error(msg.includes("invalid_grant") ? "Keyword Planner : jeton Google expiré (mode Test, 7 jours), réautorisation nécessaire" : `Keyword Planner : ${msg}`);
  }
  if (!res.access_token) throw new Error("Keyword Planner : pas de jeton d'accès dans la réponse");
  return { token: res.access_token, customer };
}

export const keywordsPlugin: Plugin = {
  id: "keywords",
  title: { fr: "Mots-clés", en: "Keywords" },
  description: { fr: "Ce que les gens tapent dans Google, page par page (Keyword Planner) : volumes, tendance sur 12 mois, concurrence.",
    en: "What people type into Google, page by page (Keyword Planner): volumes, 12-month trend, competition." },
  category: PLUGIN_CATEGORY.site,
  settings: jsonSettings(parseKeywordsDecl, { fr: "Groupes de mots-clés par page, et NOMS des variables du serveur qui portent les identifiants Google. Pris en compte à la prochaine collecte.",
    en: "Keyword groups per page, and NAMES of the server variables holding the Google credentials. Applied at the next collection." }),
  register(api) {
    const decl = parseKeywordsDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSetting({ key: KEYWORDS_SETTING, value: decl.groups });
    api.declareSnapshot({ id: KEYWORDS_SNAPSHOT, label: "Idées de mots-clés par page, volumes et tendance", sourceId: decl.source.id, keepDays: decl.keepDays, optional: true });
    api.registerSnapshotCollector({ id: "keywords.ideas", snapshot: KEYWORDS_SNAPSHOT, run: async (ctx) => {
      const { token, customer } = await accessToken(ctx, decl);
      const items: SnapshotItem[] = [];
      for (const g of decl.groups) {
        const body = JSON.stringify({ keywordSeed: { keywords: g.seeds }, geoTargetConstants: [decl.api.geo], language: decl.api.language, keywordPlanNetwork: decl.api.network });
        const text = await ctx.postText(decl.api.ideasUrl.replace("{customer}", customer), body, { authorization: `Bearer ${token}`, "content-type": "application/json" });
        // une même idée peut sortir dans deux groupes : la clé porte le groupe
        for (const idea of parseIdeas(text, g, decl.perGroup)) items.push({ key: `${g.id}|${idea.text}`, value: idea });
      }
      return { date: parisDate(), items };
    } });
  },
};
