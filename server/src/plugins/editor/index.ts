// Plugin « rédaction par IA » : Claude relit chaque page telle qu'elle est en ligne, avec les recherches
// réelles qui la concernent (plugin mots-clés), et PROPOSE un titre et une description pour les moteurs.
// Rien n'est publié sans validation humaine (/admin/ia). Chaque proposition passe des contrôles qui savent
// échouer : longueur, aucun chiffre inventé, aucun tiret cadratin, pas de nom de marque en double.
//
// Source d'APPOINT : sans clé, sans budget ou sans réponse, la collecte continue et garde les dernières
// propositions. Le budget mensuel est un plafond dur, compté sur la dépense réelle de chaque appel.
// Le SDK n'est chargé qu'au moment de l'appel (import dynamique, plus bas) : l'écran d'administration du site
// importe la liste des plugins, et ne doit pas embarquer le SDK pour autant.
import { z } from "zod";
import { PLUGIN_CATEGORY, type CollectContext, type Plugin, type SnapshotItem } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { addDays, parisDate } from "../../units.js";
import { KEYWORDS_SETTING, KEYWORDS_SNAPSHOT, type KeywordGroup, type KeywordIdea } from "../keywords/index.js";
import { checkProposal, EDITOR_PLUGIN_ID, EDITOR_PUBLISH_SETTING, EDITOR_SNAPSHOT, parseEditorDecl, readPage, RUN_KEY, spentThisMonth, type EditorDecl, type EditorRun, type Proposal } from "./model.js";

export * from "./model.js";

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

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
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
