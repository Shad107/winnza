import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_COOKIE, ADMIN_PATH, login } from '#lib/server/admin-auth.ts';

/** Durée d'une session d'administration. */
const SESSION_SECONDS = 12 * 60 * 60;

export const actions = {
  default: async ({ request, cookies }) => {
    const cookie = login(String((await request.formData()).get('token') ?? ''));
    if (!cookie) return fail(401, { wrong: true });
    // cookie limité à l'administration, illisible par le JavaScript de la page, jamais envoyé depuis un autre site
    cookies.set(ADMIN_COOKIE, cookie, { path: ADMIN_PATH, httpOnly: true, sameSite: 'strict', maxAge: SESSION_SECONDS });
    redirect(303, '/admin/plugins');
  },
};
