import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { ADMIN_COOKIE, ADMIN_LOGIN_PATH, ADMIN_PATH, adminEnabled, isAdmin } from '#lib/server/admin-auth.ts';

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
  return resolve(event);
};
