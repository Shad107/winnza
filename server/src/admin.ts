// Administration des plugins : lister, activer, éteindre, lire et enregistrer les réglages. Tout passe
// par le moteur partagé (OpenPluginHost) : un réglage n'atteint la base qu'après le contrôle du plugin.
// Un changement prend effet à la collecte suivante (c'est elle qui charge les plugins).
import { createPluginHost, enabledIn, withPluginOff, withPluginOn, type EnabledState, type PluginInfo, type SettingField, type SettingValue } from "@isno-open/plugin-host";
import { PLUGIN_CATEGORIES, PLUGIN_CATEGORY, type PluginApi, type PluginCategory } from "./contract.js";
import { BUILTIN_PLUGINS, ENABLED_RULES, PLUGINS_ENABLED_SETTING, pluginSettingKey } from "./plugins/builtins.js";
import type { Store } from "./store.js";

export type PluginRow = PluginInfo<PluginCategory> & { enabled: boolean };
export type SettingsScreen = { plugin: PluginInfo<PluginCategory>; fields: readonly SettingField[]; values: Record<string, SettingValue> };

/** Un hôte qui ne charge rien : il sert à lire les fiches et à valider les réglages. */
function host(store: Store) {
  return createPluginHost<PluginApi, PluginCategory>({
    builtins: BUILTIN_PLUGINS, categories: PLUGIN_CATEGORIES, defaultCategory: PLUGIN_CATEGORY.other,
    makeApi: () => { throw new Error("l'administration ne charge pas les plugins"); },
    storedSettings: (id) => store.settingOrNull(pluginSettingKey(id)),
  });
}

const enabledState = (store: Store) => store.settingOrNull(PLUGINS_ENABLED_SETTING) as EnabledState | null;

export function listPlugins(store: Store): PluginRow[] {
  const h = host(store);
  const enabled = enabledIn(enabledState(store), ENABLED_RULES);
  return Object.keys(BUILTIN_PLUGINS).map((id) => ({ ...h.builtinInfo(id)!, enabled: enabled.includes(id) }));
}

export function setPluginEnabled(store: Store, id: string, on: boolean): void {
  if (!BUILTIN_PLUGINS[id]) throw new Error(`plugin inconnu : ${id}`);
  const state = enabledState(store) ?? {};
  store.putSetting(PLUGINS_ENABLED_SETTING, on ? withPluginOn(state, id, ENABLED_RULES) : withPluginOff(state, id, ENABLED_RULES));
}

export function settingsScreen(store: Store, id: string): SettingsScreen | null {
  const h = host(store);
  const plugin = h.builtinInfo(id);
  const form = h.settingsForm(id);
  return plugin && form ? { plugin, fields: form.fields, values: form.values } : null;
}

/** Valide par le plugin, puis enregistre. Lève l'erreur du plugin si la saisie est refusée. */
export function saveSettings(store: Store, id: string, input: Record<string, unknown>): void {
  if (!BUILTIN_PLUGINS[id]) throw new Error(`plugin inconnu : ${id}`);
  const value = host(store).settingsFromForm(id, input);
  if (value === null) throw new Error(`le plugin ${id} n'a pas de réglages`);
  store.putSetting(pluginSettingKey(id), value);
}
