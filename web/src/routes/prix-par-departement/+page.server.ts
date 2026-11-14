import { error } from '@sveltejs/kit';
import { departmentsPage } from '#lib/server/data.ts';

// Les contours de la carte ne partent qu'avec cette page, pas avec toutes les autres.
export const load = () => {
  const departments = departmentsPage();
  if (!departments) error(404, 'Carte indisponible');
  return { departments };
};
