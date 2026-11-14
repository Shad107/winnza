// Plugin « Search Console » : ce que Google fait des pages du site (recherches, impressions, clics, position),
// sur les derniers jours. Pour l'IA qui gère le site : mesurer l'effet de ses changements, repérer les pages
// vues mais peu cliquées, les recherches où l'on est proche de la première page. Données non publiées.
//
// Source d'APPOINT : sans clé ou sans réponse, la collecte continue. Le jeton demandé est en LECTURE SEULE
// (portée webmasters.readonly), quels que soient les droits du compte de service.
import { createSign } from "node:crypto";
import { PLUGIN_CATEGORY, type CollectContext, type Plugin, type SnapshotItem, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { addDays, parisDate } from "../../units.js";

export type SearchConsoleDecl = {
  source: SourceDecl; site: string;
  api: { tokenUrl: string; scope: string; queryUrl: string; secret: string };
  days: number; delayDays: number; rowLimit: number; keepDays: number;
};
/** Une ligne : une recherche sur une page, sur la période. */
export type SearchRow = { page: string; query: string; clicks: number; impressions: number; ctr: number; position: number };
/** L'élément qui décrit la période (présent même sans aucune ligne : un site neuf n'a pas encore d'impressions). */
export type SearchPeriod = { from: string; to: string; rows: number };

export const SEARCH_CONSOLE_SNAPSHOT = "search-console.queries";
export const PERIOD_KEY = "_periode";
const READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type Obj = Record<string, unknown>;
const fail = (where: string, what: string): never => { throw new Error(`search-console.json, ${where} : ${what}`); };
const obj = (o: unknown, where: string): Obj => (o && typeof o === "object" && !Array.isArray(o) ? (o as Obj) : fail(where, "objet attendu"));
const str = (o: Obj, k: string, where: string): string => (typeof o[k] === "string" && o[k] ? (o[k] as string) : fail(where, `« ${k} » manquant`));
const int = (o: Obj, k: string, where: string): number => (Number.isInteger(o[k]) && (o[k] as number) >= 0 ? (o[k] as number) : fail(where, `« ${k} » : entier attendu`));

export function parseSearchConsoleDecl(json: unknown): SearchConsoleDecl {
  const root = obj(json, "racine"), s = obj(root.source, "source"), a = obj(root.api, "api");
  const site = str(root, "site", "racine");
  if (!/^https:\/\/[^/]+\/$/.test(site)) fail("racine", "site : la propriété exacte, https://…/ avec la barre finale");
  const scope = str(a, "scope", "api");
  // la lecture seule n'est pas une option : un autre droit serait refusé ici plutôt que demandé à Google
  if (scope !== READONLY_SCOPE) fail("api", `scope : seule la lecture (${READONLY_SCOPE}) est permise`);
  const secret = str(a, "secret", "api");
  if (!/^[A-Z][A-Z0-9_]*$/.test(secret)) fail("api", "secret : un NOM de variable (majuscules), jamais la clé");
  const queryUrl = str(a, "queryUrl", "api");
  if (!queryUrl.includes("{site}")) fail("api", "queryUrl doit contenir {site}");
  return {
    source: { id: str(s, "id", "source"), name: str(s, "name", "source"), publisher: str(s, "publisher", "source"), url: str(s, "url", "source"), licence: str(s, "licence", "source") },
    site, api: { tokenUrl: str(a, "tokenUrl", "api"), scope, queryUrl, secret },
    days: int(root, "days", "racine"), delayDays: int(root, "delayDays", "racine"), rowLimit: int(root, "rowLimit", "racine"), keepDays: int(root, "keepDays", "racine"),
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** L'assertion JWT signée (RS256) du compte de service, échangée ensuite contre un jeton d'accès. */
export function serviceAccountAssertion(key: { client_email: string; private_key: string }, scope: string, aud: string, nowSeconds: number): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope, aud, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(key.private_key);
  return `${head}.${claims}.${b64url(sig)}`;
}

/** Réponse de searchAnalytics.query (dimensions page puis query) -> lignes. */
export function parseRows(text: string): SearchRow[] {
  let d: { rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[] };
  try { d = JSON.parse(text); } catch { throw new Error("Search Console : la réponse n'est pas du JSON"); }
  return (d.rows ?? []).flatMap((r) => {
    const [page, query] = r.keys ?? [];
    if (!page || !query) return [];
    return [{ page, query, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0, ctr: r.ctr ?? 0, position: r.position ?? 0 }];
  });
}

async function accessToken(ctx: CollectContext, decl: SearchConsoleDecl): Promise<string> {
  const raw = ctx.secret(decl.api.secret);
  if (!raw) throw new Error(`Search Console : variable ${decl.api.secret} absente sur le serveur`);
  let key: { client_email?: string; private_key?: string };
  try { key = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); } catch { throw new Error(`Search Console : ${decl.api.secret} n'est pas un JSON de compte de service encodé en base64`); }
  if (!key.client_email || !key.private_key) throw new Error("Search Console : compte de service incomplet (client_email ou private_key)");
  const assertion = serviceAccountAssertion({ client_email: key.client_email, private_key: key.private_key }, decl.api.scope, decl.api.tokenUrl, Math.floor(Date.now() / 1000));
  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString();
  const res = JSON.parse(await ctx.postText(decl.api.tokenUrl, body, { "content-type": "application/x-www-form-urlencoded" })) as { access_token?: string };
  if (!res.access_token) throw new Error("Search Console : pas de jeton d'accès dans la réponse");
  return res.access_token;
}

export const searchConsolePlugin: Plugin = {
  id: "search-console",
  title: { fr: "Search Console", en: "Search Console" },
  description: { fr: "Ce que Google fait des pages du site : recherches, impressions, clics, position. Lecture seule, pour l'IA qui gère le site.",
    en: "What Google does with the site's pages: queries, impressions, clicks, position. Read-only, for the AI running the site." },
  category: PLUGIN_CATEGORY.site,
  settings: jsonSettings(parseSearchConsoleDecl, { fr: "Propriété, période, et NOM de la variable du serveur qui porte le compte de service. Lecture seule imposée.",
    en: "Property, period, and NAME of the server variable holding the service account. Read-only enforced." }),
  register(api) {
    const decl = parseSearchConsoleDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSnapshot({ id: SEARCH_CONSOLE_SNAPSHOT, label: "Recherches Google par page : impressions, clics, position", sourceId: decl.source.id, keepDays: decl.keepDays, optional: true });
    api.registerSnapshotCollector({ id: "search-console.queries", snapshot: SEARCH_CONSOLE_SNAPSHOT, run: async (ctx) => {
      const today = parisDate();
      const to = addDays(today, -decl.delayDays), from = addDays(to, -(decl.days - 1));
      const token = await accessToken(ctx, decl);
      const url = decl.api.queryUrl.replace("{site}", encodeURIComponent(decl.site));
      const text = await ctx.postText(url, JSON.stringify({ startDate: from, endDate: to, dimensions: ["page", "query"], rowLimit: decl.rowLimit }),
        { authorization: `Bearer ${token}`, "content-type": "application/json" });
      const rows = parseRows(text);
      const period: SearchPeriod = { from, to, rows: rows.length };
      const items: SnapshotItem[] = [{ key: PERIOD_KEY, value: period }, ...rows.map((r) => ({ key: `${r.page}|${r.query}`, value: r }))];
      return { date: today, items };
    } });
  },
};
