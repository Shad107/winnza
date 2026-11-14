import { fail } from '@sveltejs/kit';
import { approve, buildEditorPage, setBlocked } from '@winnza/core/pages/editor-page.js';
import { EDITOR_BLOCKED_SETTING, EDITOR_OVERRIDES_SETTING, EDITOR_PLUGIN_ID } from '@winnza/core/plugins/editor/model.js';
import { parisDate } from '@winnza/core/units.js';
import { withReadStore, withWritableStore } from '#lib/server/data.ts';

// Page d'administration (protégée par le garde de /admin) : ce que l'IA a écrit, ce qui est en ligne, et de quoi
// bloquer une page (elle garde alors son titre d'origine).
export const load = () => ({ editor: withReadStore((s) => buildEditorPage(s, parisDate())) });

export const actions = {
  approve: async ({ request }) => {
    const path = String((await request.formData()).get('path') ?? '');
    try {
      withWritableStore((s) => s.putSetting(EDITOR_OVERRIDES_SETTING, approve(buildEditorPage(s, parisDate()), path, parisDate()), EDITOR_PLUGIN_ID));
    } catch (e) { return fail(400, { error: e instanceof Error ? e.message : String(e) }); }
    return { done: path };
  },
  block: async ({ request }) => {
    const fd = await request.formData();
    const path = String(fd.get('path') ?? '');
    withWritableStore((s) => s.putSetting(EDITOR_BLOCKED_SETTING, setBlocked(buildEditorPage(s, parisDate()), path, fd.get('on') === '1'), EDITOR_PLUGIN_ID));
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
