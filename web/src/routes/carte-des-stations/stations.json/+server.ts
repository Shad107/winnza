import { error } from '@sveltejs/kit';
import { stationsMapJson } from '#lib/server/data.ts';

// Les stations de la carte : un fichier par collecte, que le navigateur peut garder quelques minutes.
export const GET = () => {
  const json = stationsMapJson();
  if (!json) error(404, 'Carte des stations indisponible');
  return new Response(json, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600' } });
};
