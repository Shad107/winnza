import { error } from '@sveltejs/kit';
import { cityPage } from '#lib/server/data.ts';

export const load = ({ params }) => {
  const page = cityPage(params.ville);
  if (!page) error(404, "Aucune station relevée dans cette ville.");
  return page;
};
