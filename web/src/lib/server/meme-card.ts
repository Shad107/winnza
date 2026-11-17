// Ce que les composants d'un mème affichent, calculé côté serveur : le dessin en SVG (fond servi à part, en
// JPEG), les textes, la source, les personnages et l'épisode précédent.
import { memeSvg } from './meme-svg.ts';
import { findCharacter, findMeme, memeImageUrl, memePath, memePngPath, memeSharePath, memeWeek } from './memes.ts';

export const characterPath = (id: string) => `/personnages#${id}`;

export function memeCard(slug: string) {
  const m = findMeme(slug), image = memeImageUrl(slug);
  if (!m || !image) return null;
  const prev = m.previous ? findMeme(m.previous) : null;
  return {
    slug, title: m.title, date: m.date, week: memeWeek(m), alt: m.alt, top: m.top, bottom: m.bottom, lead: m.lead, source: m.source,
    image, svg: memeSvg(m, image), png: memePngPath(slug), share: memeSharePath(slug), href: memePath(slug),
    characters: m.characters.map(findCharacter).filter((c) => c !== null).map((c) => ({ name: c.name, href: characterPath(c.id) })),
    previous: prev ? { title: prev.title, week: memeWeek(prev), href: memePath(prev.slug) } : null,
  };
}
export type MemeCardData = NonNullable<ReturnType<typeof memeCard>>;
