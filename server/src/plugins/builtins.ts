// Les plugins livrés avec Winnza, et où sont rangés leur état et leurs réglages en base. Lu par la
// collecte et par l'administration : une seule liste.
import type { Plugin } from "../contract.js";
import { fuelPlugin } from "./fuel/index.js";
import { hiddenChargesPlugin } from "./hidden-charges/index.js";
import { sitePlugin } from "./site/index.js";
import { stationsPlugin } from "./stations/index.js";
import { matomoPlugin } from "./matomo/index.js";
import { forecastPlugin } from "./forecast/index.js";
import { mapPlugin } from "./map/index.js";
import { stationNamesPlugin } from "./station-names/index.js";

export const BUILTIN_PLUGINS: Readonly<Record<string, Plugin>> = {
  [fuelPlugin.id]: fuelPlugin, [hiddenChargesPlugin.id]: hiddenChargesPlugin, [sitePlugin.id]: sitePlugin,
  [stationsPlugin.id]: stationsPlugin, [matomoPlugin.id]: matomoPlugin,
  [forecastPlugin.id]: forecastPlugin,
  [mapPlugin.id]: mapPlugin,
  [stationNamesPlugin.id]: stationNamesPlugin,
};

/** Règles des plugins actifs : tous actifs tant que rien n'est enregistré, aucun imposé d'office. */
export const ENABLED_RULES = { defaults: Object.keys(BUILTIN_PLUGINS), alwaysOn: [] as string[] };

/** Réglage en base : liste des plugins activés et éteints. */
export const PLUGINS_ENABLED_SETTING = "plugins.enabled";
/** Réglage en base : la configuration d'un plugin. */
export const pluginSettingKey = (id: string) => `plugin.${id}`;
