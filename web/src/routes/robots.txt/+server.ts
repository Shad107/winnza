import { robots } from '#lib/plugins/seo/index.ts';
import { siteDecl } from '#lib/server/data.ts';

export const GET = () => new Response(robots(siteDecl()), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
