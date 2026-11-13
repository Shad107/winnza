// Le site ne lit QUE la base : tout ce qu'il affiche y a été écrit par un plugin. Ouverture en lecture
// seule ; recalcul seulement quand la base change (date de modification), pas à chaque visite.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '@winnza/core/store.js';
import { buildFuelPage, type FuelPage } from '@winnza/core/pages/fuel-page.js';
import { parseSiteDecl, SITE_SETTING, type SiteDecl } from '@winnza/core/plugins/site/index.js';

const DB = process.env.WINNZA_DB ?? join(process.cwd(), '..', 'data', 'energy.db');

let cache: { mtime: number; page: FuelPage; site: SiteDecl } | null = null;

function load() {
  const mtime = statSync(DB).mtimeMs;
  if (cache && cache.mtime === mtime) return cache;
  const store = new Store(DB, { readonly: true });
  try {
    cache = { mtime, page: buildFuelPage(store), site: parseSiteDecl(store.setting(SITE_SETTING.site)) };
    return cache;
  } finally {
    store.close();
  }
}

/** Base en écriture, pour l'administration seulement (réglages des plugins). Fermée après usage. */
export function withWritableStore<T>(fn: (store: Store) => T): T {
  const store = new Store(DB);
  try { return fn(store); } finally { store.close(); }
}

export const fuelPage = (): FuelPage => load().page;
export const siteDecl = (): SiteDecl => load().site;
