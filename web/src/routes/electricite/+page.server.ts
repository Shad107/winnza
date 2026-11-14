import { error } from '@sveltejs/kit';
import { electricityPage } from '#lib/server/data.ts';

// La page n'existe que si le plugin électricité a tourné : sinon, une vraie 404 plutôt qu'une page vide.
export const load = () => {
  const electricity = electricityPage();
  if (!electricity) error(404, "Page indisponible : les données d'électricité n'ont pas encore été collectées.");
  return { electricity };
};
