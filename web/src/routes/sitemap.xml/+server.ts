import { sitemap } from '#lib/plugins/seo/index.ts';
import { siteDecl } from '#lib/server/data.ts';
import { memePath, memes } from '#lib/server/memes.ts';

// l'accueil et le casting (déclarés), plus une page par mème
const MEME_PAGE = { changefreq: 'yearly', priority: 0.7 } as const;

export const GET = () => new Response(sitemap(siteDecl(), memes[0]?.date ?? new Date().toISOString().slice(0, 10),
  memes.map((m) => ({ path: memePath(m.slug), ...MEME_PAGE }))), {
  headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
});
