// Point d'entrée.
//   node dist/cli.js collect [base]          collecte ; réglages absents initialisés depuis declarations/
//   node dist/cli.js seed <plugin> [base]    recharge les réglages d'un plugin depuis son fichier
//   node dist/cli.js plugins [base]          liste les plugins, actifs ou non
//   node dist/cli.js outlines <geojson> <declaration.json>   contours des départements (plugin carte)
//
// La base est la seule vérité : un plugin lit ses réglages en base. Les fichiers de declarations/ ne
// servent qu'à INITIALISER une base neuve (ou à recharger un plugin avec `seed`), en attendant l'écran
// d'administration et le plugin IA.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enabledIn, type EnabledState } from "@isno-open/plugin-host";
import { parseAnchors } from "./anchors.js";
import { httpContext } from "./http.js";
import { BUILTIN_PLUGINS as BUILTINS, ENABLED_RULES as RULES, PLUGINS_ENABLED_SETTING, pluginSettingKey as settingKey } from "./plugins/builtins.js";
import { fuelPlugin } from "./plugins/fuel/index.js";
import { hiddenChargesPlugin } from "./plugins/hidden-charges/index.js";
import { sitePlugin } from "./plugins/site/index.js";
import { stationsPlugin } from "./plugins/stations/index.js";
import { matomoPlugin } from "./plugins/matomo/index.js";
import { forecastPlugin } from "./plugins/forecast/index.js";
import { mapPlugin, outlinesFromGeoJson, parseMapDecl } from "./plugins/map/index.js";
import { electricityPlugin } from "./plugins/electricity/index.js";
import { stationNamesPlugin } from "./plugins/station-names/index.js";
import { buildRegistry, runCollect } from "./runner.js";
import { Store } from "./store.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const declaration = (name: string): unknown => JSON.parse(readFileSync(join(ROOT, "declarations", name), "utf8"));

/** Réglages initiaux de chaque plugin, lus dans declarations/. */
const SEEDS: Record<string, () => unknown> = {
  [fuelPlugin.id]: () => declaration("fuel.json"),
  [hiddenChargesPlugin.id]: () => declaration("hidden-charges.json"),
  [sitePlugin.id]: () => ({ site: declaration("site.json"), fuelPage: declaration("fuel-page.json") }),
  [stationsPlugin.id]: () => declaration("stations.json"),
  [matomoPlugin.id]: () => declaration("matomo.json"),
  [forecastPlugin.id]: () => declaration("forecast.json"),
  [mapPlugin.id]: () => declaration("map.json"),
  [stationNamesPlugin.id]: () => declaration("station-names.json"),
  [electricityPlugin.id]: () => declaration("electricity.json"),
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
  if (command === "outlines") {
    if (!a || !b) throw new Error("usage : node dist/cli.js outlines <departements.geojson> <declaration.json>");
    const current = JSON.parse(readFileSync(b, "utf8")) as Record<string, unknown>;
    const next = { ...current, ...outlinesFromGeoJson(JSON.parse(readFileSync(a, "utf8")), 600) };
    parseMapDecl(next);   // on n'écrit qu'une déclaration que le plugin acceptera
    writeFileSync(b, JSON.stringify(next) + "\n");
    console.log(`${next.shapes.length} départements, ${JSON.stringify(next).length} octets`);
    return;
  }
  const dbPath = (command === "seed" ? b : a) ?? join(ROOT, "data", "energy.db");
  const store = new Store(dbPath);
  try {
    if (command === "seed") {
      if (!a || !SEEDS[a]) throw new Error(`plugin inconnu : ${a ?? "(aucun)"} ; connus : ${Object.keys(SEEDS).join(", ")}`);
      store.putSetting(settingKey(a), SEEDS[a]!());
      console.log(`réglages de ${a} rechargés depuis declarations/`);
      return;
    }
    const enabled = enabledIn(store.settingOrNull(PLUGINS_ENABLED_SETTING) as EnabledState | null, RULES);
    if (command === "plugins") {
      for (const p of Object.values(BUILTINS)) console.log(`${enabled.includes(p.id) ? "actif  " : "inactif"} ${p.id.padEnd(16)} ${p.title.fr} (${p.category ?? "other"})`);
      return;
    }
    if (command !== "collect") {
      console.error("usage : node dist/cli.js collect|plugins [base] ; node dist/cli.js seed <plugin> [base]");
      process.exitCode = 2;
      return;
    }
    const started = new Date().toISOString();
    try {
      const reg = await buildRegistry(BUILTINS, enabled, (id) => settingsOf(store, id));
      const report = await runCollect(store, reg, httpContext, parseAnchors(declaration("anchors.json")));
      const msg = reg.failed.map((f) => `${f.id} : ${f.error}`).join(" ; ");
      store.db.prepare("INSERT INTO collect_run (started_at, finished_at, ok, observations, message) VALUES (?, ?, ?, ?, ?)")
        .run(started, new Date().toISOString(), reg.failed.length ? 0 : 1, report.observations, msg || null);
      console.log(`collecte : ${report.observations} valeurs, plugins ${reg.loaded.join(", ")}, ${report.anchors.length} ancres vérifiées`);
      for (const r of report.anchors) console.log(`  ✓ ${r.anchor.seriesId} ${r.anchor.aggregate} [${r.anchor.from}..${r.anchor.to}] = ${r.actual?.toFixed(4)} (attendu ${r.anchor.expected} ±${r.anchor.tolerance}, ${r.anchor.publishedBy})`);
      for (const w of report.warnings) console.log(`  ! source d'appoint absente : ${w}`);
      for (const s of report.skipped) console.log(`  - ancre non vérifiée (plugin inactif) : ${s.seriesId}`);
      // un plugin écarté ne bloque pas les autres, mais la collecte le signale par son code de sortie
      if (reg.failed.length) { console.error(`plugins écartés : ${msg}`); process.exitCode = 1; }
    } catch (e) {
      store.db.prepare("INSERT INTO collect_run (started_at, finished_at, ok, message) VALUES (?, ?, 0, ?)")
        .run(started, new Date().toISOString(), String(e instanceof Error ? e.message : e));
      console.error(`collecte en échec : ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    }
  } finally {
    store.close();
  }
}

await main();
