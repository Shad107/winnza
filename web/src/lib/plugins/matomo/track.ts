// Envoi d'une page vue à Matomo, côté serveur et sans cookie (réglages : plugin « matomo » du socle).
// Pièges vérifiés sur isno.fr : le jeton est en « requêtes sécurisées uniquement », donc token_auth et
// cip partent dans le CORPS d'un POST (en query : 400). Le cip donne la vraie IP du visiteur, pour la
// géolocalisation et l'exclusion des IP d'Olivier déclarées dans Matomo.
import type { MatomoSettings } from '@winnza/core/plugins/matomo/index.js';
import { MATOMO_MODE } from '@winnza/core/plugins/matomo/index.js';

const BOT_UA = /bot|crawl|spider|slurp|monitor|preview|curl|wget|python|httpclient|headless|lighthouse|uptime/i;

/** IP privée, de boucle, de réseau Docker ou de CGNAT : jamais un visiteur réel. */
export function isInternalIp(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/, '');
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.)/.test(v4)
    || ip === '::1' || /^f[cd]/i.test(ip) || /^fe80:/i.test(ip);
}

export const isBot = (ua: string): boolean => !ua || BOT_UA.test(ua);

export type PageView = { url: string; ip: string; ua: string; lang: string; referrer: string };

/** Le corps de la requête de suivi (sans le jeton) : séparé pour pouvoir le tester. */
export function trackingBody(s: MatomoSettings, v: PageView): URLSearchParams {
  return new URLSearchParams({
    idsite: String(s.siteId), rec: '1', apiv: '1', send_image: '0',
    url: v.url, ua: v.ua, lang: v.lang, urlref: v.referrer, cip: v.ip,
    rand: Math.random().toString(36).slice(2),
  });
}

/** Envoie la page vue ; ne lève jamais (un Matomo en panne ne doit rien casser). */
export async function trackPageView(s: MatomoSettings | null, token: string | undefined, v: PageView): Promise<void> {
  if (!s?.enabled || !token || isBot(v.ua) || isInternalIp(v.ip)) return;
  const body = trackingBody(s, v);
  if (s.mode === MATOMO_MODE.dry) { console.log(`[matomo essai] ${v.url} ${v.ip}`); return; }
  body.set('token_auth', token);
  try {
    const res = await fetch(`${s.url}/matomo.php`, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) console.error(`[matomo] HTTP ${res.status}`);
  } catch (e) {
    console.error(`[matomo] échec : ${e instanceof Error ? e.message : e}`);
  }
}
