import { error } from '@sveltejs/kit';
import { citiesIndex } from '#lib/server/data.ts';

/** grandes villes : celles qui comptent le plus de stations */
const BIG_CITIES = 24;

// L'index reste léger : départements et grandes villes. La liste complète part à la demande (recherche)
// et par département (une page chacun).
export const load = () => {
  const index = citiesIndex();
  if (!index) error(404, "Page indisponible : le relevé des stations n'a pas encore été collecté.");
  const counts = new Map<string, number>();
  for (const c of index.list) counts.set(c.dep, (counts.get(c.dep) ?? 0) + 1);
  return {
    date: index.date, total: index.list.length,
    departments: index.departments.map((d) => ({ ...d, cities: counts.get(d.code) ?? 0 })),
    big: [...index.list].sort((a, b) => b.stations - a.stations || a.name.localeCompare(b.name, 'fr')).slice(0, BIG_CITIES),
  };
};
