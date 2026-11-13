import { json } from '@sveltejs/kit';
import { saveSettings } from '@winnza/core/admin.js';
import { withWritableStore } from '#lib/server/data.ts';

// Enregistre les réglages d'un plugin, après SON contrôle. La garde d'accès est dans hooks.server.ts.
export const POST = async ({ params, request }) => {
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: 'requête illisible' }, { status: 400 }); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'réglages attendus' }, { status: 400 });
  try {
    withWritableStore((s) => saveSettings(s, params.id, input as Record<string, unknown>));
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
};
