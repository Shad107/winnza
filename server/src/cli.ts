// Point d'entrée.
//   node dist/cli.js collect [base]          collecte ; réglages absents initialisés depuis declarations/
//   node dist/cli.js seed <plugin> [base]    recharge les réglages d'un plugin depuis son fichier
//   node dist/cli.js plugins [base]          liste les plugins, actifs ou non
//   node dist/cli.js outlines <geojson> <declaration.json>   contours des départements (plugin carte)
//
// La base est la seule vérité : un plugin lit ses réglages en base. Les fichiers de declarations/ ne
// servent qu'à INITIALISER une base neuve (ou à recharger un plugin avec `seed`), en attendant l'écran
// d'administration et le plugin IA.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enabledIn, type EnabledState } from "@isno-open/plugin-host";
import { parseAnchors } from "./anchors.js";
import { httpContext } from "./http.js";
import { BUILTIN_PLUGINS as BUILTINS, ENABLED_RULES as RULES, PLUGINS_ENABLED_SETTING, pluginSettingKey as settingKey } from "./plugins/builtins.js";
import { sitePlugin } from "./plugins/site/index.js";
import { matomoPlugin } from "./plugins/matomo/index.js";
import { keywordIdeas, keywordsPlugin, parseKeywordsDecl } from "./plugins/keywords/index.js";
import { searchConsolePlugin } from "./plugins/search-console/index.js";
import { buildRegistry, runCollect } from "./runner.js";
import { Store } from "./store.js";
import { buildTrends } from "./pages/trends.js";
import { parisDate } from "./units.js";
import { seedSettings } from "./seed.js";

/** Keyword Planner à la demande : au plus 10 mots par appel (limite de l'API : 20), 40 idées, 4 derniers mois. */
const KEYWORD_IDEAS = { maxWords: 10, limit: 40, months: 4 } as const;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const declaration = (name: string): unknown => JSON.parse(readFileSync(join(ROOT, "declarations", name), "utf8"));

/** Réglages initiaux de chaque plugin, lus dans declarations/. */
const SEEDS: Record<string, () => unknown> = {
  [sitePlugin.id]: () => ({ site: declaration("site.json") }),
  [matomoPlugin.id]: () => declaration("matomo.json"),
  [keywordsPlugin.id]: () => declaration("keywords.json"),
  [searchConsolePlugin.id]: () => declaration("search-console.json"),
};

function settingsOf(store: Store, id: string): unknown {
  const stored = store.settingOrNull(settingKey(id));
  if (stored !== null) return stored;
  const seed = SEEDS[id]?.();
  if (seed === undefined) return null;
  store.putSetting(settingKey(id), seed);   // base neuve : on initialise, puis la base fait foi
  return seed;
}

async function main(): Promise<void> {
  const [command, a, b] = process.argv.slice(2);
  if (command === "trends") {
    // tendances du jour pour l'IA qui gère le site (base en lecture seule), sur la sortie standard
    const store = new Store(a ?? join(ROOT, "data", "energy.db"), { readonly: true });
    try { console.log(JSON.stringify(buildTrends(store, parisDate()), null, 2)); } finally { store.close(); }
    return;
  }
  if (command === "keyword-ideas") {
    // Keyword Planner à la demande, pour l'IA qui gère le site : node dist/cli.js keyword-ideas "mot 1" "mot 2"
    // Les identifiants Google sont lus dans l'environnement (variables nommées dans declarations/keywords.json).
    const words = process.argv.slice(3).map((w) => w.trim()).filter(Boolean);
    if (!words.length || words.length > KEYWORD_IDEAS.maxWords) throw new Error(`usage : node dist/cli.js keyword-ideas "mot" ... (de 1 à ${KEYWORD_IDEAS.maxWords} mots)`);
    const ideas = await keywordIdeas(httpContext, parseKeywordsDecl(declaration("keywords.json")), { id: "demande", page: "/", label: "à la demande", seeds: words }, KEYWORD_IDEAS.limit);
    console.log(JSON.stringify(ideas.map((i) => ({ text: i.text, volume: i.volume, competition: i.competition, lastMonths: i.months.slice(-KEYWORD_IDEAS.months) })), null, 2));
    return;
  }
  const dbPath = (command === "seed" ? b : a) ?? join(ROOT, "data", "energy.db");
  const store = new Store(dbPath);
  try {
    if (command === "seed") {
      if (!a || !SEEDS[a]) throw new Error(`plugin inconnu : ${a ?? "(aucun)"} ; connus : ${Object.keys(SEEDS).join(", ")}`);
      const enabled = enabledIn(store.settingOrNull(PLUGINS_ENABLED_SETTING) as EnabledState | null, RULES);
      await seedSettings(store, BUILTINS[a]!, SEEDS[a]!(), enabled.includes(a));
      console.log(`réglages de ${a} rechargés depuis declarations/`);
      return;
    }
    const enabled = enabledIn(store.settingOrNull(PLUGINS_ENABLED_SETTING) as EnabledState | null, RULES);
    if (command === "plugins") {
      for (const p of Object.values(BUILTINS)) console.log(`${enabled.includes(p.id) ? "actif  " : "inactif"} ${p.id.padEnd(16)} ${p.title.fr} (${p.category ?? "other"})`);
      return;
    }
    if (command !== "collect") {
      console.error("usage : node dist/cli.js collect|plugins [base] ; seed <plugin> [base] ; trends [base] ; keyword-ideas \"mot\" ...");
      process.exitCode = 2;
      return;
    }
    const started = new Date().toISOString();
    try {
      const reg = await buildRegistry(BUILTINS, enabled, (id) => settingsOf(store, id));
      const report = await runCollect(store, reg, httpContext, parseAnchors(declaration("anchors.json")));
      const msg = reg.failed.map((f) => `${f.id} : ${f.error}`).join(" ; ");
      store.recordRun({ startedAt: started, ok: !reg.failed.length, observations: report.observations, message: msg || null, warnings: report.warnings });
      console.log(`collecte : ${report.observations} valeurs, plugins ${reg.loaded.join(", ")}, ${report.anchors.length} ancres vérifiées`);
      for (const r of report.anchors) console.log(`  ✓ ${r.anchor.seriesId} ${r.anchor.aggregate} [${r.anchor.from}..${r.anchor.to}] = ${r.actual?.toFixed(4)} (attendu ${r.anchor.expected} ±${r.anchor.tolerance}, ${r.anchor.publishedBy})`);
      for (const w of report.warnings) console.log(`  ! source d'appoint absente : ${w}`);
      for (const s of report.skipped) console.log(`  - ancre non vérifiée (plugin inactif) : ${s.seriesId}`);
      // un plugin écarté ne bloque pas les autres, mais la collecte le signale par son code de sortie
      if (reg.failed.length) { console.error(`plugins écartés : ${msg}`); process.exitCode = 1; }
    } catch (e) {
      store.recordRun({ startedAt: started, ok: false, observations: 0, message: String(e instanceof Error ? e.message : e), warnings: [] });
      console.error(`collecte en échec : ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    }
  } finally {
    store.close();
  }
}

await main();
