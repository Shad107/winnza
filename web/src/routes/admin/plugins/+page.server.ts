import { fail, redirect } from '@sveltejs/kit';
import { listPlugins, setPluginEnabled } from '@winnza/core/admin.js';
import { withWritableStore } from '#lib/server/data.ts';
import { ADMIN_COOKIE, ADMIN_PATH } from '#lib/server/admin-auth.ts';

export const load = () => ({ plugins: withWritableStore(listPlugins) });

export const actions = {
  toggle: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    try { withWritableStore((s) => setPluginEnabled(s, id, fd.get('on') === '1')); }
    catch (e) { return fail(400, { error: e instanceof Error ? e.message : String(e) }); }
    return { changed: id };
  },
  logout: ({ cookies }) => {
    cookies.delete(ADMIN_COOKIE, { path: ADMIN_PATH });
    redirect(303, '/');
  },
};
