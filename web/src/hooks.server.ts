import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { ADMIN_COOKIE, ADMIN_LOGIN_PATH, ADMIN_PATH, adminEnabled, isAdmin } from '#lib/server/admin-auth.ts';
import { analytics } from '#lib/server/data.ts';
import { trackPageView } from '#lib/plugins/matomo/track.ts';

// Garde de l'administration : inexistante sans jeton configuré, fermée sans le bon cookie.
export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  if (path === ADMIN_PATH || path.startsWith(ADMIN_PATH + '/')) {
    if (!adminEnabled()) error(404, 'Page introuvable');
    if (path !== ADMIN_LOGIN_PATH && !isAdmin(event.cookies.get(ADMIN_COOKIE))) redirect(303, ADMIN_LOGIN_PATH);
    const res = await resolve(event);
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    res.headers.set('cache-control', 'no-store');
    return res;
  }
  const res = await resolve(event);
  // page vue côté serveur (plugin matomo) : pages HTML réussies seulement, envoi en arrière-plan
  if (event.request.method === 'GET' && res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/html')) {
    let ip = '';
    try { ip = event.getClientAddress(); } catch { /* pas d'adresse : rien n'est envoyé */ }
    void trackPageView(analytics(), process.env.MATOMO_TOKEN, {
      url: event.url.href, ip, ua: event.request.headers.get('user-agent') ?? '',
      lang: event.request.headers.get('accept-language') ?? '', referrer: event.request.headers.get('referer') ?? '',
    });
  }
  return res;
};
