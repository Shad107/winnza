import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Store } from "./store.js";
import { sitePlugin, SITE_SETTING, parseSiteDecl } from "./plugins/site/index.js";
import { ANALYTICS_SETTING } from "./plugins/matomo/index.js";
import { pluginSettingKey } from "./plugins/builtins.js";
import { seedSettings } from "./seed.js";

const site = JSON.parse(readFileSync(join(process.cwd(), "..", "declarations", "site.json"), "utf8"));

test("ressemis : la commande publie immédiatement l'identité sans collecte", () => {
  const dir = mkdtempSync(join(tmpdir(), "winnza-seed-"));
  const path = join(dir, "site.db");
  try {
    const before = new Store(path);
    before.putSetting(SITE_SETTING.site, { ...site, description: "Ancienne description" }, sitePlugin.id);
    before.putSetting(ANALYTICS_SETTING, { enabled: false }, "matomo");
    before.close();
    const result = spawnSync(process.execPath, [join(import.meta.dirname, "cli.js"), "seed", sitePlugin.id, path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const after = new Store(path);
    try {
      assert.deepEqual(after.setting(SITE_SETTING.site), parseSiteDecl(site));
      assert.deepEqual(after.setting(ANALYTICS_SETTING), { enabled: false });
      assert.equal(after.recentRuns(1).length, 0);
    } finally { after.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ressemis : une déclaration refusée ne remplace aucun réglage (témoin)", async () => {
  const store = new Store(":memory:");
  try {
    await seedSettings(store, sitePlugin, { site }, true);
    await assert.rejects(seedSettings(store, sitePlugin, { site: { ...site, description: "" } }, true), /description/);
    assert.deepEqual(store.setting(pluginSettingKey(sitePlugin.id)), { site });
    assert.deepEqual(store.setting(SITE_SETTING.site), parseSiteDecl(site));
  } finally { store.close(); }
});

test("ressemis : un plugin éteint reste absent des réglages publiés", async () => {
  const store = new Store(":memory:");
  try {
    await seedSettings(store, sitePlugin, { site }, false);
    assert.deepEqual(store.setting(pluginSettingKey(sitePlugin.id)), { site });
    assert.equal(store.settingOrNull(SITE_SETTING.site), null);
  } finally { store.close(); }
});
