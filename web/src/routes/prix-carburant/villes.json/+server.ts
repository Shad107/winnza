import { error } from '@sveltejs/kit';
import { citiesSearchJson } from '#lib/server/data.ts';

// Pour la recherche de l'index : [nom, département, adresse] de chaque ville, chargé à la première frappe.
export const GET = () => {
  const json = citiesSearchJson();
  if (!json) error(404, 'Villes indisponibles');
  return new Response(json, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
