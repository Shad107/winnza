// Le site ne lit QUE la base : tout ce qu'il affiche y a été écrit par un plugin. Ouverture en lecture
// seule ; recalcul seulement quand la base change (date de modification), pas à chaque visite.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '@winnza/core/store.js';
import { buildFuelPage, type FuelPage } from '@winnza/core/pages/fuel-page.js';
import { buildDepartmentsPage, type DepartmentsPage } from '@winnza/core/pages/departments-page.js';
import { buildStationsMap } from '@winnza/core/pages/stations-map.js';
import { buildElectricityPage, type ElectricityPage } from '@winnza/core/pages/electricity-page.js';
import { buildRunningCostPage, type RunningCostPage } from '@winnza/core/pages/running-cost-page.js';
import { buildCities, type Cities, type City } from '@winnza/core/pages/cities.js';
import { liveOverrides, type Override } from '@winnza/core/plugins/editor/model.js';
import { parseSiteDecl, SITE_SETTING, type SiteDecl } from '@winnza/core/plugins/site/index.js';
import { ANALYTICS_SETTING, parseMatomoSettings, type MatomoSettings } from '@winnza/core/plugins/matomo/index.js';

const DB = process.env.WINNZA_DB ?? join(process.cwd(), '..', 'data', 'energy.db');

let cache: { mtime: number; page: FuelPage; departments: DepartmentsPage | null; stationsJson: string | null; electricity: ElectricityPage | null; runningCost: RunningCostPage | null; cities: Cities; seo: Record<string, Override>; site: SiteDecl; analytics: MatomoSettings | null } | null = null;

/** Page optionnelle (son plugin peut être éteint ou mal réglé) : une erreur la retire, journalisée, au
 *  lieu de faire tomber tout le site. Les pages carburant, elles, restent obligatoires. */
/** Pages retirées au dernier calcul, avec la raison : publiées dans /etat.json pour qui doit réparer. */
let pageErrors: string[] = [];
function optional<T>(name: string, build: () => T | null): T | null {
  try { return build(); } catch (e) {
    const why = `page ${name} retirée : ${e instanceof Error ? e.message : String(e)}`;
    console.error(why); pageErrors.push(why); return null;
  }
}
export const currentPageErrors = (): readonly string[] => { load(); return pageErrors; };

function load() {
  const mtime = statSync(DB).mtimeMs;
  if (cache && cache.mtime === mtime) return cache;
  const store = new Store(DB, { readonly: true });
  pageErrors = [];
  try {
    const a = store.settingOrNull(ANALYTICS_SETTING);
    const stations = optional('carte des stations', () => buildStationsMap(store));
    cache = { mtime, page: buildFuelPage(store), departments: optional('départements', () => buildDepartmentsPage(store)), stationsJson: stations && JSON.stringify(stations), electricity: optional('électricité', () => buildElectricityPage(store)), runningCost: optional('coût aux 100 km', () => buildRunningCostPage(store)), cities: optional('villes', () => buildCities(store)), seo: optional('titres de l\'IA', () => liveOverrides(store)) ?? {}, site: parseSiteDecl(store.setting(SITE_SETTING.site)), analytics: a === null ? null : parseMatomoSettings(a) };
    return cache;
  } finally {
    store.close();
  }
}

/** Base en lecture, à la demande : pour l'administration (pas de cache, pages rares). */
export function withReadStore<T>(fn: (store: Store) => T): T {
  const store = new Store(DB, { readonly: true });
  try { return fn(store); } finally { store.close(); }
}

/** Base en écriture, pour l'administration seulement (réglages des plugins). Fermée après usage. */
export function withWritableStore<T>(fn: (store: Store) => T): T {
  const store = new Store(DB);
  try { return fn(store); } finally { store.close(); }
}

export const fuelPage = (): FuelPage => load().page;
/** Carte et prix par département : chargés par leur seule page (les contours pèsent quelques dizaines de Ko). */
export const departmentsPage = (): DepartmentsPage | null => load().departments;
/** Carte des stations, déjà sérialisée (environ 9 500 points : on ne la recalcule qu'à chaque collecte). */
export const stationsMapJson = (): string | null => load().stationsJson;

/** Page électricité, ou null si le plugin n'a jamais tourné ou est éteint. */
export const electricityPage = (): ElectricityPage | null => load().electricity;

/** Page coût aux 100 km, ou null si le plugin n'a jamais tourné ou est éteint. */
export const runningCostPage = (): RunningCostPage | null => load().runningCost;

/** Une ville (page « prix du carburant à … »), ou null si elle n'existe pas. */
export const cityPage = (slug: string): { city: City; date: string; compareDate: string | null } | null => {
  const c = load().cities;
  const city = c?.bySlug.get(slug);
  return c && city ? { city, date: c.date, compareDate: c.compareDate } : null;
};
/** L'index des villes, par département. */
export const citiesIndex = () => {
  const c = load().cities;
  return c ? { date: c.date, departments: c.departments, list: c.list } : null;
};
/** Liste compacte des villes pour la recherche (nom, département, adresse), sérialisée une fois. */
let searchCache: { mtime: number; json: string } | null = null;
export const citiesSearchJson = (): string | null => {
  const c = load();
  if (!c.cities) return null;
  if (searchCache?.mtime !== c.mtime) searchCache = { mtime: c.mtime, json: JSON.stringify(c.cities.list.map((x) => [x.name, x.dep, x.slug])) };
  return searchCache.json;
};

/** Titres et descriptions de l'IA réellement en ligne (publiés seuls ou validés), par chemin de page. */
export const seoOverrides = (): Record<string, Override> => load().seo;

/** Réglages de mesure d'audience (plugin matomo), ou null si le plugin n'a jamais tourné ou est éteint. */
export const analytics = (): MatomoSettings | null => load().analytics;
export const siteDecl = (): SiteDecl => load().site;
