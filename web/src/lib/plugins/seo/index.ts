// Plugin SEO. Une page ne fabrique jamais ses balises à la main : elle décrit ce qu'elle est (titre,
// description, questions) et ce plugin rend tout le reste (canonique, Open Graph, données structurées
// schema.org, plan du site, robots.txt). Plus tard, le plugin Keyword Planner lui fournira les
// formulations que les gens tapent vraiment.

// L'identité du site (adresse, nom, pages) est écrite en base par le plugin « site » du socle.
import type { SiteDecl } from '@winnza/core/plugins/site/index.js';
export type { SiteDecl };

export type PageSeo = {
  path: string;
  title: string;
  description: string;
  /** questions-réponses affichées sur la page : publiées aussi en FAQPage pour les moteurs */
  faq?: { q: string; a: string }[];
  /** date de la dernière mise à jour des données de la page (AAAA-MM-JJ) */
  modified?: string;
};

type Obj = Record<string, unknown>;

/** Données structurées schema.org de la page, à insérer en JSON-LD. */
export function jsonLd(site: SiteDecl, page: PageSeo): string {
  const graph: Obj[] = [
    { '@type': 'WebSite', '@id': `${site.url}/#site`, url: site.url, name: site.name, inLanguage: 'fr-FR' },
    { '@type': 'WebPage', url: site.url + page.path, name: page.title, description: page.description, isPartOf: { '@id': `${site.url}/#site` },
      ...(page.modified ? { dateModified: page.modified } : {}) },
  ];
  if (page.faq?.length) {
    graph.push({ '@type': 'FAQPage', mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  // « < » échappé : le JSON ne peut pas fermer la balise <script> qui le contient
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sitemap(site: SiteDecl, lastmod: string): string {
  const urls = site.pages.map((p) => `  <url><loc>${xml(site.url + p.path)}</loc><lastmod>${lastmod}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robots(site: SiteDecl): string {
  // l'administration n'a rien à faire dans un moteur de recherche (elle répond aussi « noindex »)
  return `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${site.url}/sitemap.xml\n`;
}
