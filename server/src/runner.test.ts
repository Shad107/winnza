import { test } from "node:test";
import assert from "node:assert/strict";
import { AGGREGATE, parseAnchors, type Anchor } from "./anchors.js";
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type CollectContext, type Plugin } from "./contract.js";
import { buildRegistry, runCollect } from "./runner.js";
import { Store } from "./store.js";

const noNet: CollectContext = { fetchBytes: async () => new Uint8Array(), fetchText: async () => "" };

/** Un plugin d'essai : sa série vaut ce que dit son réglage en base. */
const plugin: Plugin = {
  id: "essai", title: { fr: "Essai", en: "Test" }, category: PLUGIN_CATEGORY.data,
  register(api) {
    const value = (api.settings() as { value: number }).value;
    api.declareSource({ id: "src", name: "s", publisher: "p", url: "u", licence: "l" });
    api.declareSeries({ id: "x", label: "x", unit: UNIT.eurPerLitre, frequency: FREQUENCY.daily, sourceId: "src" });
    api.registerCollector({ id: "c", run: async () => [{ seriesId: "x", date: "2020-01-01", value }] });
  },
};
const settings = (id: string) => (id === "essai" ? { value: 2 } : null);
const anchor = (expected: number, seriesId = "x"): Anchor => ({ seriesId, from: "2020-01-01", to: "2020-01-31", aggregate: AGGREGATE.mean,
  expected, tolerance: 0.1, publishedBy: "test", url: "u" });

test("un plugin lit ses réglages en base, et l'ancre respectée laisse écrire", async () => {
  const store = new Store(":memory:");
  const reg = await buildRegistry({ essai: plugin }, ["essai"], settings);
  const r = await runCollect(store, reg, noNet, [anchor(2)]);
  assert.equal(r.anchors[0]!.ok, true);
  assert.deepEqual(store.get("x").map((o) => o.value), [2]);
});

// Témoin de mutation : le contrôle doit SAVOIR échouer, et l'échec ne doit rien laisser en base.
test("une ancre violée : la collecte échoue et la base reste vide", async () => {
  const store = new Store(":memory:");
  const reg = await buildRegistry({ essai: plugin }, ["essai"], settings);
  await assert.rejects(runCollect(store, reg, noNet, [anchor(3)]), /ancres non respectées/);
  assert.equal(store.get("x").length, 0);
});

test("un plugin en échec est écarté sans rien laisser au registre, les autres passent", async () => {
  const casse: Plugin = { id: "casse", title: { fr: "Cassé", en: "Broken" }, register(api) {
    api.declareSource({ id: "fantome", name: "f", publisher: "p", url: "u", licence: "l" });
    throw new Error("réglage invalide");
  } };
  const reg = await buildRegistry({ essai: plugin, casse }, ["casse", "essai"], settings, () => {});
  assert.deepEqual(reg.loaded, ["essai"]);
  assert.deepEqual(reg.failed.map((f) => [f.id, f.error]), [["casse", "réglage invalide"]]);
  assert.equal(reg.sources.has("fantome"), false, "ce qu'il avait déclaré avant d'échouer est oublié");
  // ses ancres ne sont pas vérifiées, et c'est dit
  const r = await runCollect(new Store(":memory:"), reg, noNet, [anchor(2), anchor(9, "serie-du-plugin-casse")]);
  assert.deepEqual(r.skipped.map((a) => a.seriesId), ["serie-du-plugin-casse"]);
});

test("deux plugins qui déclarent la même série : le second est écarté", async () => {
  const jumeau: Plugin = { ...plugin, id: "jumeau" };
  const reg = await buildRegistry({ essai: plugin, jumeau }, ["essai", "jumeau"], (id) => (id === "jumeau" || id === "essai" ? { value: 1 } : null), () => {});
  assert.deepEqual(reg.loaded, ["essai"]);
  assert.match(reg.failed[0]!.error, /déjà déclaré par un autre plugin : source src, série x/);
});

test("une observation d'une série non déclarée est refusée", async () => {
  const bad: Plugin = { ...plugin, register(api) { plugin.register(api); api.registerCollector({ id: "d", run: async () => [{ seriesId: "typo", date: "2020-01-01", value: 1 }] }); } };
  const reg = await buildRegistry({ essai: bad }, ["essai"], settings);
  await assert.rejects(runCollect(new Store(":memory:"), reg, noNet, []), /série non déclarée typo/);
});

test("anchors.json : un agrégat inconnu est une erreur", () => {
  assert.throws(() => parseAnchors([{ ...anchor(1), aggregate: "median" }]), /agrégat inconnu/);
});

test("éteindre un plugin efface les réglages qu'il avait écrits (le site cesse de les utiliser)", async () => {
  const store = new Store(":memory:");
  const avecReglage: Plugin = { ...plugin, register(api) { plugin.register(api); api.declareSetting({ key: "essai.public", value: 1 }); } };
  await runCollect(store, await buildRegistry({ essai: avecReglage }, ["essai"], settings), noNet, []);
  assert.equal(store.settingOrNull("essai.public"), 1);
  store.putSetting("plugin.essai", { value: 2 });   // configuration d'administration : jamais effacée
  await runCollect(store, await buildRegistry({ essai: avecReglage }, [], settings), noNet, []).catch(() => {});
  assert.equal(store.settingOrNull("essai.public"), null);
  assert.deepEqual(store.settingOrNull("plugin.essai"), { value: 2 });
});

const snapPlugin = (items: { key: string; value: unknown }[], date = "2026-11-20"): Plugin => ({
  id: "photo", title: { fr: "p", en: "p" }, description: { fr: "p", en: "p" },
  register(api) {
    plugin.register(api);
    api.declareSnapshot({ id: "photo.jour", label: "l", sourceId: "src", keepDays: 7 });
    api.registerSnapshotCollector({ id: "photo", snapshot: "photo.jour", run: async () => ({ date, items }) });
  },
});

test("instantané : le relevé du jour remplace celui du même jour, et les jours trop anciens s'effacent", async () => {
  const store = new Store(":memory:");
  const run = async (items: { key: string; value: unknown }[], date: string) =>
    runCollect(store, await buildRegistry({ photo: snapPlugin(items, date) }, ["photo"], () => ({ value: 2 })), noNet, []);
  await run([{ key: "a", value: 1 }, { key: "b", value: 2 }], "2026-11-01");
  await run([{ key: "a", value: 3 }], "2026-11-05");
  await run([{ key: "a", value: 4 }], "2026-11-05");
  assert.deepEqual(store.snapshot("photo.jour", "2026-11-05"), [{ key: "a", value: 4 }], "même jour : remplacé en entier");
  await run([{ key: "a", value: 5 }], "2026-11-10");
  assert.deepEqual(store.snapshotDates("photo.jour"), ["2026-11-05", "2026-11-10"], "plus de 7 jours : effacé");
});

test("instantané vide ou avec une clé en double : la collecte échoue sans rien écrire", async () => {
  const store = new Store(":memory:");
  for (const items of [[], [{ key: "a", value: 1 }, { key: "a", value: 2 }]]) {
    const reg = await buildRegistry({ photo: snapPlugin(items) }, ["photo"], () => ({ value: 2 }));
    await assert.rejects(runCollect(store, reg, noNet, []), /instantané vide|clés en double/);
  }
  assert.deepEqual(store.snapshotDates("photo.jour"), []);
});

test("instantané d'appoint : sa source ne répond pas, la collecte continue et le signale", async () => {
  const store = new Store(":memory:");
  const flaky: Plugin = { id: "appoint", title: { fr: "a", en: "a" }, register(api) {
    plugin.register(api);
    api.declareSnapshot({ id: "appoint.jour", label: "l", sourceId: "src", keepDays: 7, optional: true });
    api.registerSnapshotCollector({ id: "appoint", snapshot: "appoint.jour", run: async () => { throw new Error("serveur saturé"); } });
  } };
  const r = await runCollect(store, await buildRegistry({ appoint: flaky }, ["appoint"], () => ({ value: 2 })), noNet, []);
  assert.match(r.warnings[0]!, /serveur saturé/);
  assert.deepEqual(store.get("x").map((o) => o.value), [2], "le reste est écrit");
});
