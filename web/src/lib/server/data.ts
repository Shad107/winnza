// Le site lit la base pour son identité (plugin site), la mesure d'audience (plugin matomo) et l'état
// public ; les mèmes, eux, sont des fichiers du dépôt (memes.ts). Ouverture en lecture seule ; relecture
// seulement quand la base change (date de modification), pas à chaque visite.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '@winnza/core/store.js';
import { parseSiteDecl, SITE_SETTING, type SiteDecl } from '@winnza/core/plugins/site/index.js';
import { ANALYTICS_SETTING, parseMatomoSettings, type MatomoSettings } from '@winnza/core/plugins/matomo/index.js';

const DB = process.env.WINNZA_DB ?? join(process.cwd(), '..', 'data', 'energy.db');

let cache: { mtime: number; site: SiteDecl; analytics: MatomoSettings | null } | null = null;

function load() {
  const mtime = statSync(DB).mtimeMs;
  if (cache && cache.mtime === mtime) return cache;
  const store = new Store(DB, { readonly: true });
  try {
    const a = store.settingOrNull(ANALYTICS_SETTING);
    cache = { mtime, site: parseSiteDecl(store.setting(SITE_SETTING.site)), analytics: a === null ? null : parseMatomoSettings(a) };
    return cache;
  } finally {
    store.close();
  }
}

/** Base en lecture, à la demande : pour l'administration et l'état public (pas de cache, pages rares). */
export function withReadStore<T>(fn: (store: Store) => T): T {
  const store = new Store(DB, { readonly: true });
  try { return fn(store); } finally { store.close(); }
}

/** Base en écriture, pour l'administration seulement (réglages des plugins). Fermée après usage. */
export function withWritableStore<T>(fn: (store: Store) => T): T {
  const store = new Store(DB);
  try { return fn(store); } finally { store.close(); }
}

/** Réglages de mesure d'audience (plugin matomo), ou null si le plugin n'a jamais tourné ou est éteint. */
export const analytics = (): MatomoSettings | null => load().analytics;
export const siteDecl = (): SiteDecl => load().site;
