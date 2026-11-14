import { error } from '@sveltejs/kit';
import { runningCostPage } from '#lib/server/data.ts';

// La page n'existe que si le plugin a tourné : sinon, une vraie 404 plutôt qu'une page vide.
export const load = () => {
  const cost = runningCostPage();
  if (!cost) error(404, "Page indisponible : les données de coût aux 100 km n'ont pas encore été collectées.");
  return { cost };
};
