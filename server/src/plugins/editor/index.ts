// Plugin « rédaction par IA » : une IA (OpenAI ou Anthropic, selon la déclaration) relit chaque page telle
// qu'elle est en ligne, avec les recherches réelles qui la concernent (plugin mots-clés), et écrit un titre, une
// description et une accroche d'image de partage. Publiés seuls (publish = auto) ou après validation
// (/admin/ia). Chaque proposition passe des contrôles qui savent échouer : longueur, aucun chiffre inventé,
// aucun tiret cadratin, pas de nom de marque en double.
//
// Source d'APPOINT : sans clé, sans budget ou sans réponse, la collecte continue et garde les dernières
// propositions. Le budget mensuel est un plafond dur, compté sur la dépense réelle de chaque appel.
// Le SDK d'Anthropic n'est chargé qu'au moment de l'appel (import dynamique, plus bas) : l'écran d'administration du site
// importe la liste des plugins, et ne doit pas embarquer le SDK pour autant.
import { z } from "zod";
import { PLUGIN_CATEGORY, type CollectContext, type Plugin, type SnapshotItem } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { addDays, parisDate } from "../../units.js";
import { KEYWORDS_SETTING, KEYWORDS_SNAPSHOT, type KeywordGroup, type KeywordIdea } from "../keywords/index.js";
import { checkProposal, EDITOR_PLUGIN_ID, EDITOR_PUBLISH_SETTING, EDITOR_SNAPSHOT, parseEditorDecl, PROVIDER, readPage, RUN_KEY, spentThisMonth, type EditorDecl, type EditorRun, type Proposal } from "./model.js";

export * from "./model.js";

const ProposalsSchema = z.object({
  proposals: z.array(z.object({
    path: z.string(), title: z.string(), description: z.string(), shareText: z.string(),
    keywords: z.array(z.string()), reason: z.string(),
  })),
});

/** Les consignes, avec les limites de la déclaration (sans elles, l'IA dépassait toutes les longueurs : mesuré le 2026-11-14). */
const system = (decl: EditorDecl) => `${SYSTEM}
Longueurs maximales, espaces compris, à respecter strictement : titre ${decl.limits.title} caractères, description ${decl.limits.description} caractères, accroche ${decl.limits.share} caractères (c'est ce que les moteurs affichent ; au-delà, le texte est coupé). Une description fait au moins 50 caractères.`;

const SYSTEM = `Tu rédiges, en français, le titre et la description que les moteurs de recherche affichent pour chaque page d'un site d'information grand public sur le prix de l'énergie (carburant, électricité).
Pour chaque page, tu reçois ce qu'elle montre aujourd'hui (titre, description, titre visible, introduction) et les recherches que les gens tapent vraiment, avec leur volume mensuel.
Règles :
- reprendre les formulations les plus cherchées qui correspondent VRAIMENT au contenu de la page ; ne jamais promettre ce que la page ne contient pas ;
- aucun chiffre qui ne figure pas déjà dans ce que la page montre : les prix changent chaque jour, la page les écrit elle-même ;
- pas le nom du site dans le titre : il est ajouté automatiquement ;
- pas de tiret cadratin ni demi-cadratin ; ton factuel, sans superlatif publicitaire ni point d'exclamation ;
- si le titre actuel est déjà le meilleur, le reproposer tel quel et le dire dans la raison.
Pour chaque page, écris aussi l'accroche de son image de partage (réseaux sociaux) : une phrase courte qui donne envie de cliquer, sans chiffre (le chiffre du jour est ajouté sur l'image), sans point d'exclamation.
Pour chaque page, donne le chemin exact reçu, le titre, la description, l'accroche, les recherches visées, et une raison courte.`;

/** Le schéma de la réponse, en JSON Schema strict (OpenAI) : toutes les propriétés exigées, aucune de plus. */
const PROPOSALS_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["proposals"],
  properties: { proposals: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["path", "title", "description", "shareText", "keywords", "reason"],
    properties: { path: { type: "string" }, title: { type: "string" }, description: { type: "string" }, shareText: { type: "string" },
      keywords: { type: "array", items: { type: "string" } }, reason: { type: "string" } },
  } } },
} as const;

type Answer = { id: string; model: string; parsed: z.infer<typeof ProposalsSchema>; inputTokens: number; cachedInputTokens: number; outputTokens: number };

/** OpenAI, API Responses : sortie structurée stricte, puis revalidée par Zod à la réception. */
async function askOpenAI(ctx: CollectContext, decl: EditorDecl, key: string, user: string): Promise<Answer> {
  const body = { model: decl.api.model, reasoning: { effort: decl.api.effort }, max_output_tokens: decl.api.maxTokens,
    input: [{ role: "system", content: system(decl) }, { role: "user", content: user }],
    text: { format: { type: "json_schema", name: "propositions", strict: true, schema: PROPOSALS_JSON_SCHEMA } } };
  let r: { id?: string; model?: string; status?: string; output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } };
  try { r = JSON.parse(await ctx.postText(decl.api.url!, JSON.stringify(body), { authorization: `Bearer ${key}`, "content-type": "application/json" })); }
  catch (e) { throw new Error(`IA : ${e instanceof Error ? e.message : String(e)}`); }
  const parts = (r.output ?? []).flatMap((o) => o.content ?? []);
  const refusal = parts.find((c) => c.type === "refusal");
  if (refusal) throw new Error(`IA : refus du modèle (${refusal.refusal ?? "sans motif"})`);
  const text = parts.find((c) => c.type === "output_text")?.text;
  if (r.status !== "completed" || !text) throw new Error(`IA : réponse incomplète (statut : ${r.status ?? "inconnu"})`);
  const parsed = ProposalsSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("IA : réponse hors du schéma attendu");
  return { id: r.id ?? "sans-id", model: r.model ?? decl.api.model, parsed: parsed.data,
    inputTokens: r.usage?.input_tokens ?? 0, cachedInputTokens: r.usage?.input_tokens_details?.cached_tokens ?? 0, outputTokens: r.usage?.output_tokens ?? 0 };
}

/** Anthropic, par le SDK officiel (chargé à la demande), avec repli en cas de refus. */
async function askAnthropic(ctx: CollectContext, decl: EditorDecl, key: string, user: string): Promise<Answer> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
  const client = new Anthropic({ apiKey: key, fetch: fetchVia(ctx), maxRetries: 0 });
  const response = await client.beta.messages.parse({
    model: decl.api.model, max_tokens: decl.api.maxTokens,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: decl.api.effort, format: betaZodOutputFormat(ProposalsSchema) },
    system: system(decl), messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error(`IA : refus du modèle (${response.stop_details?.category ?? "sans catégorie"})`);
  if (!response.parsed_output) throw new Error(`IA : réponse illisible (arrêt : ${response.stop_reason})`);
  const cached = response.usage.cache_read_input_tokens ?? 0;
  return { id: response.id, model: response.model, parsed: response.parsed_output,
    inputTokens: response.usage.input_tokens + cached, cachedInputTokens: cached, outputTokens: response.usage.output_tokens };
}

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

export const editorPlugin: Plugin = {
  id: EDITOR_PLUGIN_ID,
  title: { fr: "Rédaction par IA", en: "AI editor" },
  description: { fr: "Chaque semaine, une IA (OpenAI ou Anthropic, au choix) réécrit pour chaque page le titre, la description et l'accroche d'image, d'après les recherches réelles, sous contrôle.",
    en: "Every week, an AI (OpenAI or Anthropic) rewrites each page's title, description and share text from real searches, under checks." },
  category: PLUGIN_CATEGORY.site,
  settings: jsonSettings(parseEditorDecl, { fr: "Modèle, tarif, budget mensuel (plafond dur), rythme, limites de longueur, et NOM de la variable du serveur qui porte la clé. Pris en compte à la prochaine collecte.",
    en: "Model, pricing, monthly budget (hard cap), cadence, length limits, and NAME of the server variable holding the key. Applied at the next collection." }),
  register(api) {
    const decl = parseEditorDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSetting({ key: EDITOR_PUBLISH_SETTING, value: decl.publish });
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

      const user = JSON.stringify(pages.map((p) => ({ chemin: p.path, sujet: p.label, aujourdhui: p.now, recherches: p.searches })));
      const answer = decl.api.provider === PROVIDER.openai ? await askOpenAI(ctx, decl, key, user) : await askAnthropic(ctx, decl, key, user);
      const parsed = answer.parsed;
      const runId = `${today}-${answer.id}`;
      const pr = decl.pricing;
      const run: EditorRun = { runId, date: today, model: answer.model, inputTokens: answer.inputTokens, cachedInputTokens: answer.cachedInputTokens, outputTokens: answer.outputTokens,
        costUsd: ((answer.inputTokens - answer.cachedInputTokens) * pr.inputUsdPerMTok + answer.cachedInputTokens * pr.cachedInputUsdPerMTok + answer.outputTokens * pr.outputUsdPerMTok) / 1_000_000 };
      const items: SnapshotItem[] = [{ key: RUN_KEY, value: run }];
      for (const page of pages) {
        const p = parsed.proposals.find((x) => x.path === page.path);
        if (!p) continue;   // une page oubliée par l'IA n'a pas de proposition cette semaine
        const proposal: Proposal = { path: page.path, label: page.label, current: { title: page.now.title, description: page.now.description },
          proposed: { title: p.title.trim(), description: p.description.trim(), shareText: p.shareText.trim() }, keywords: p.keywords, reason: p.reason,
          problems: checkProposal({ title: p.title.trim(), description: p.description.trim(), shareText: p.shareText.trim() }, page.now, decl), runId };
        items.push({ key: page.path, value: proposal });
      }
      return { date: today, items };
    } });
  },
};
