import { error } from '@sveltejs/kit';
import { citiesIndex } from '#lib/server/data.ts';

export const load = ({ params }) => {
  const index = citiesIndex();
  const code = params.code.toUpperCase();
  const dep = index?.departments.find((d) => d.code === code);
  if (!index || !dep) error(404, 'Département inconnu');
  return { date: index.date, dep, cities: index.list.filter((c) => c.dep === code) };
};
