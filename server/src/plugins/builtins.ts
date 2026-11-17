// Les plugins livrés avec Winnza, et où sont rangés leur état et leurs réglages en base. Lu par la
// collecte et par l'administration : une seule liste.
import type { Plugin } from "../contract.js";
import { sitePlugin } from "./site/index.js";
import { matomoPlugin } from "./matomo/index.js";
import { keywordsPlugin } from "./keywords/index.js";
import { searchConsolePlugin } from "./search-console/index.js";

export const BUILTIN_PLUGINS: Readonly<Record<string, Plugin>> = {
  [sitePlugin.id]: sitePlugin, [matomoPlugin.id]: matomoPlugin,
  [keywordsPlugin.id]: keywordsPlugin, [searchConsolePlugin.id]: searchConsolePlugin,
};

/** Règles des plugins actifs : tous actifs tant que rien n'est enregistré, aucun imposé d'office. */
export const ENABLED_RULES = { defaults: Object.keys(BUILTIN_PLUGINS), alwaysOn: [] as string[] };

/** Réglage en base : liste des plugins activés et éteints. */
export const PLUGINS_ENABLED_SETTING = "plugins.enabled";
/** Réglage en base : la configuration d'un plugin. */
export const pluginSettingKey = (id: string) => `plugin.${id}`;
