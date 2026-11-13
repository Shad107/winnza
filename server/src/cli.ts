// Point d'entrée : `node dist/cli.js collect [chemin-base]`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnchors } from "./anchors.js";
import { httpContext } from "./http.js";
import { parseFuelDecl } from "./plugins/fuel/decl.js";
import { fuelPlugin } from "./plugins/fuel/index.js";
import { hiddenChargesPlugin, parseHiddenCharges } from "./plugins/hidden-charges/index.js";
import { parseFuelPageDecl, parseSiteDecl, sitePlugin } from "./plugins/site/index.js";
import { runCollect } from "./runner.js";
import { Store } from "./store.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const declaration = (name: string): unknown => JSON.parse(readFileSync(join(ROOT, "declarations", name), "utf8"));

async function main(): Promise<void> {
  const [command, dbPath = join(ROOT, "data", "energy.db")] = process.argv.slice(2);
  if (command !== "collect") {
    console.error("usage : node dist/cli.js collect [chemin-base]");
    process.exit(2);
  }
  // Les fichiers de declarations/ sont les ENTRÉES des plugins ; seuls les plugins écrivent en base,
  // et le site ne lit que la base.
  const plugins = [
    fuelPlugin(parseFuelDecl(declaration("fuel.json"))),
    hiddenChargesPlugin(parseHiddenCharges(declaration("hidden-charges.json"))),
    sitePlugin(parseSiteDecl(declaration("site.json")), parseFuelPageDecl(declaration("fuel-page.json"))),
  ];
  const anchors = parseAnchors(declaration("anchors.json"));
  const store = new Store(dbPath);
  const started = new Date().toISOString();
  try {
    const report = await runCollect(store, plugins, httpContext, anchors);
    store.db.prepare("INSERT INTO collect_run (started_at, finished_at, ok, observations) VALUES (?, ?, 1, ?)")
      .run(started, new Date().toISOString(), report.observations);
    console.log(`collecte réussie : ${report.observations} valeurs, ${report.anchors.length} ancres vérifiées`);
    for (const r of report.anchors) console.log(`  ✓ ${r.anchor.seriesId} ${r.anchor.aggregate} [${r.anchor.from}..${r.anchor.to}] = ${r.actual?.toFixed(4)} (attendu ${r.anchor.expected} ±${r.anchor.tolerance}, ${r.anchor.publishedBy})`);
  } catch (e) {
    store.db.prepare("INSERT INTO collect_run (started_at, finished_at, ok, message) VALUES (?, ?, 0, ?)")
      .run(started, new Date().toISOString(), String(e instanceof Error ? e.message : e));
    console.error(`collecte en échec : ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  } finally {
    store.close();
  }
}

await main();
