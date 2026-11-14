import { fail } from '@sveltejs/kit';
import { approve, buildEditorPage } from '@winnza/core/pages/editor-page.js';
import { EDITOR_OVERRIDES_SETTING, EDITOR_PLUGIN_ID } from '@winnza/core/plugins/editor/index.js';
import { parisDate } from '@winnza/core/units.js';
import { withReadStore, withWritableStore } from '#lib/server/data.ts';

// Page d'administration (protégée par le garde de /admin) : les propositions de l'IA, à valider une par une.
export const load = () => ({ editor: withReadStore((s) => buildEditorPage(s, parisDate())) });

export const actions = {
  approve: async ({ request }) => {
    const path = String((await request.formData()).get('path') ?? '');
    try {
      withWritableStore((s) => s.putSetting(EDITOR_OVERRIDES_SETTING, approve(buildEditorPage(s, parisDate()), path, parisDate()), EDITOR_PLUGIN_ID));
    } catch (e) { return fail(400, { error: e instanceof Error ? e.message : String(e) }); }
    return { done: path };
  },
  revert: async ({ request }) => {
    const path = String((await request.formData()).get('path') ?? '');
    withWritableStore((s) => {
      const { [path]: _gone, ...rest } = buildEditorPage(s, parisDate()).overrides;
      s.putSetting(EDITOR_OVERRIDES_SETTING, rest, EDITOR_PLUGIN_ID);
    });
    return { done: path };
  },
};
