import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listPlugins, saveSettings, setPluginEnabled, settingsScreen } from "./admin.js";
import { pluginSettingKey } from "./plugins/builtins.js";
import { JSON_SETTING_KEY } from "./plugins/json-settings.js";
import { Store } from "./store.js";

/** la déclaration réelle des mots-clés : un plugin à configuration JSON */
const keywords = JSON.parse(readFileSync(join(process.cwd(), "..", "declarations", "keywords.json"), "utf8")) as { perGroup: number; groups: unknown[] };

test("tous les plugins livrés sont listés, actifs par défaut ; on peut en éteindre un", () => {
  const store = new Store(":memory:");
  assert.deepEqual(listPlugins(store).map((p) => [p.id, p.enabled, p.configurable]), [["site", true, true], ["matomo", true, true], ["keywords", true, true], ["search-console", true, true]]);
  setPluginEnabled(store, "keywords", false);
  assert.deepEqual(listPlugins(store).filter((p) => !p.enabled).map((p) => p.id), ["keywords"]);
  setPluginEnabled(store, "keywords", true);
  assert.equal(listPlugins(store).every((p) => p.enabled), true);
});

test("écran de réglages : la configuration en base, en JSON lisible", () => {
  const store = new Store(":memory:");
  store.putSetting(pluginSettingKey("keywords"), keywords);
  const screen = settingsScreen(store, "keywords")!;
  assert.equal(screen.plugin.title.fr, "Mots-clés");
  assert.deepEqual(JSON.parse(String(screen.values[JSON_SETTING_KEY])), keywords);
});

test("une configuration valide est enregistrée", () => {
  const store = new Store(":memory:");
  saveSettings(store, "keywords", { [JSON_SETTING_KEY]: JSON.stringify({ ...keywords, perGroup: 50 }) });
  assert.equal((store.setting(pluginSettingKey("keywords")) as { perGroup: number }).perGroup, 50);
});

// Le contrôle doit savoir échouer, et un refus ne doit rien laisser en base.
test("une configuration refusée par le plugin n'atteint jamais la base", () => {
  const store = new Store(":memory:");
  store.putSetting(pluginSettingKey("keywords"), keywords);
  assert.throws(() => saveSettings(store, "keywords", { [JSON_SETTING_KEY]: "{ pas du json" }), /JSON valide/);
  assert.throws(() => saveSettings(store, "keywords", { [JSON_SETTING_KEY]: JSON.stringify({ ...keywords, perGroup: -1 }) }), /entier positif/);
  assert.throws(() => saveSettings(store, "keywords", { [JSON_SETTING_KEY]: JSON.stringify({ ...keywords, groups: [] }) }), /liste non vide/);
  assert.equal((store.setting(pluginSettingKey("keywords")) as { perGroup: number }).perGroup, keywords.perGroup);
});

test("plugin inconnu : refusé", () => {
  assert.throws(() => saveSettings(new Store(":memory:"), "pirate", {}), /plugin inconnu/);
  assert.throws(() => setPluginEnabled(new Store(":memory:"), "pirate", true), /plugin inconnu/);
});

test("Matomo : vrais champs déclarés (pas du JSON), validés par le plugin", () => {
  const store = new Store(":memory:");
  const screen = settingsScreen(store, "matomo")!;
  assert.deepEqual(screen.fields.map((f) => f.kind), ["toggle", "text", "number", "choice"]);
  saveSettings(store, "matomo", { enabled: true, url: "https://matomo.exemple.fr/", siteId: 3, mode: "dry" });
  assert.deepEqual(store.setting(pluginSettingKey("matomo")), { enabled: true, url: "https://matomo.exemple.fr", siteId: 3, mode: "dry" });
  assert.throws(() => saveSettings(store, "matomo", { enabled: true, url: "http://pas-https.fr", siteId: 3, mode: "live" }), /https/);
  assert.throws(() => saveSettings(store, "matomo", { enabled: true, url: "https://ok.fr", siteId: 0, mode: "live" }), /entier positif/);
});
