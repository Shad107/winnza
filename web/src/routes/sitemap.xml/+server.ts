import { sitemap } from '#lib/plugins/seo/index.ts';
import { fuelPage, siteDecl } from '#lib/server/data.ts';

export const GET = () => new Response(sitemap(siteDecl(), fuelPage().asOf), {
  headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
});
