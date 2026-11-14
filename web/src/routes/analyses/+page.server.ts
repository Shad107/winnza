import { articles } from '#lib/server/articles.ts';

export const load = () => ({ list: articles.map(({ slug, title, description, date }) => ({ slug, title, description, date })) });
