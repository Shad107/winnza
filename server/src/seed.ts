import type { Plugin } from "./contract.js";
import { pluginSettingKey } from "./plugins/builtins.js";
import { buildRegistry } from "./runner.js";
import type { Store } from "./store.js";

/** Valide le ressemis et publie les réglages déclarés, sans lancer les téléchargements du plugin. */
export async function seedSettings(store: Store, plugin: Plugin, value: unknown, enabled: boolean): Promise<void> {
  const reg = await buildRegistry({ [plugin.id]: plugin }, [plugin.id], () => value);
  if (reg.failed.length) throw new Error(reg.failed.map((f) => `${f.id} : ${f.error}`).join(" ; "));
  store.db.transaction(() => {
    store.putSetting(pluginSettingKey(plugin.id), value);
    if (enabled) {
      for (const setting of reg.settings.values()) store.putSetting(setting.key, setting.value, plugin.id);
    }
  })();
}
