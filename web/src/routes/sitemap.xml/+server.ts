import { sitemap } from '#lib/plugins/seo/index.ts';
import { citiesIndex, fuelPage, siteDecl } from '#lib/server/data.ts';
import { CITY_PATH } from '@winnza/core/pages/cities.js';

// les pages déclarées, plus une page par ville (prix relevés chaque jour)
const CITY_PAGE = { changefreq: 'daily', priority: 0.6 } as const;

export const GET = () => new Response(sitemap(siteDecl(), fuelPage().asOf,
  [...(citiesIndex()?.departments ?? []).map((d) => ({ path: `${CITY_PATH}/departement/${d.code.toLowerCase()}`, ...CITY_PAGE })),
   ...(citiesIndex()?.list ?? []).map((c) => ({ path: `${CITY_PATH}/${c.slug}`, ...CITY_PAGE }))]), {
  headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
});
