import { error } from '@sveltejs/kit';
import { renderArticle } from '#lib/server/articles.ts';

export const load = ({ params }) => {
  const r = renderArticle(params.slug);
  if (!r) error(404, 'Analyse introuvable');
  return { article: r.article, html: r.html };
};
