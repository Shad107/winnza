import { test } from "node:test";
import assert from "node:assert/strict";
import { listPlugins, saveSettings, setPluginEnabled, settingsScreen } from "./admin.js";
import { pluginSettingKey } from "./plugins/builtins.js";
import { JSON_SETTING_KEY } from "./plugins/json-settings.js";
import { Store } from "./store.js";

const charge = { id: "cee", label: "CEE", description: "d", eurPerLitre: 0.17, asOf: "2026-09-11", source: { name: "s", url: "https://exemple" } };

test("tous les plugins livrés sont listés, actifs par défaut ; on peut en éteindre un", () => {
  const store = new Store(":memory:");
  assert.deepEqual(listPlugins(store).map((p) => [p.id, p.enabled, p.configurable]), [["fuel", true, true], ["hidden-charges", true, true], ["site", true, true], ["stations", true, true], ["matomo", true, true], ["forecast", true, true]]);
  setPluginEnabled(store, "hidden-charges", false);
  assert.deepEqual(listPlugins(store).filter((p) => !p.enabled).map((p) => p.id), ["hidden-charges"]);
  setPluginEnabled(store, "hidden-charges", true);
  assert.equal(listPlugins(store).every((p) => p.enabled), true);
});

test("écran de réglages : la configuration en base, en JSON lisible", () => {
  const store = new Store(":memory:");
  store.putSetting(pluginSettingKey("hidden-charges"), { charges: [charge] });
  const screen = settingsScreen(store, "hidden-charges")!;
  assert.equal(screen.plugin.title.fr, "Charges cachées");
  assert.deepEqual(JSON.parse(String(screen.values[JSON_SETTING_KEY])), { charges: [charge] });
});

test("une configuration valide est enregistrée", () => {
  const store = new Store(":memory:");
  saveSettings(store, "hidden-charges", { [JSON_SETTING_KEY]: JSON.stringify({ charges: [{ ...charge, eurPerLitre: 0.18 }] }) });
  assert.equal((store.setting(pluginSettingKey("hidden-charges")) as { charges: { eurPerLitre: number }[] }).charges[0]!.eurPerLitre, 0.18);
});

// Le contrôle doit savoir échouer, et un refus ne doit rien laisser en base.
test("une configuration refusée par le plugin n'atteint jamais la base", () => {
  const store = new Store(":memory:");
  store.putSetting(pluginSettingKey("hidden-charges"), { charges: [charge] });
  assert.throws(() => saveSettings(store, "hidden-charges", { [JSON_SETTING_KEY]: "{ pas du json" }), /JSON valide/);
  assert.throws(() => saveSettings(store, "hidden-charges", { [JSON_SETTING_KEY]: JSON.stringify({ charges: [{ ...charge, eurPerLitre: -1 }] }) }), /positif ou null/);
  assert.throws(() => saveSettings(store, "fuel", { [JSON_SETTING_KEY]: JSON.stringify({ products: [] }) }), /fuel\.json/);
  assert.equal((store.setting(pluginSettingKey("hidden-charges")) as { charges: { eurPerLitre: number }[] }).charges[0]!.eurPerLitre, 0.17);
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
