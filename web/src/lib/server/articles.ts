// Les analyses (content/analyses/*.md), intégrées au moment de la construction : une analyse publiée passe
// donc par l'intégration continue, qui vérifie ses règles (server/src/pages/articles.test.ts). Les jetons
// de données sont remplacés à l'affichage par les valeurs de la base.
import { marked } from 'marked';
import { parseArticle, resolveArticle, type Article } from '@winnza/core/pages/articles.js';
import { withReadStore } from './data.ts';

const files = import.meta.glob('../../../../content/analyses/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Toutes les analyses, de la plus récente à la plus ancienne. */
export const articles: readonly Article[] = Object.entries(files)
  .map(([path, raw]) => parseArticle(path.split('/').pop()!.replace(/\.md$/, ''), raw))
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

/** Une analyse rendue en HTML, chiffres tirés de la base ; null si elle n'existe pas. */
export function renderArticle(slug: string): { article: Article; html: string; missing: string[] } | null {
  const article = articles.find((a) => a.slug === slug);
  if (!article) return null;
  const { markdown, missing } = withReadStore((s) => resolveArticle(article, s));
  if (missing.length) console.error(`analyse ${slug} : données indisponibles ${missing.join(', ')}`);
  // le corps est du Markdown sans HTML (vérifié par la CI) : on échappe quand même les chevrons par prudence
  const html = marked.parse(markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;'), { async: false });
  return { article, html, missing };
}
