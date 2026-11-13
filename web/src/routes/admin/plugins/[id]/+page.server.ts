import { error } from '@sveltejs/kit';
import { settingsScreen } from '@winnza/core/admin.js';
import { withWritableStore } from '#lib/server/data.ts';

export const load = ({ params }) => {
  const screen = withWritableStore((s) => settingsScreen(s, params.id));
  if (!screen) error(404, 'Plugin inconnu ou sans réglages');
  return { id: params.id, ...screen };
};
