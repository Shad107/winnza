// L'aperçu d'un mème pour les réseaux sociaux (balise og:image), 1200 × 630, rendu en PNG.
// /partage/dernier.png : toujours le dernier mème (aperçu de l'accueil).
import { error } from '@sveltejs/kit';
import { findMeme, LATEST, memeImageInline, memes, memeWeek } from '#lib/server/memes.ts';
import { memeShareSvg, SHARE_H, SHARE_W } from '#lib/server/meme-svg.ts';
import { pngResponse } from '#lib/server/png.ts';

export const GET = ({ params }) => {
  const slug = params.slug === LATEST ? memes[0]?.slug : params.slug;
  const m = slug ? findMeme(slug) : null, bg = slug ? memeImageInline(slug) : null;
  if (!m || !bg) error(404, 'Image introuvable');
  return pngResponse(memeShareSvg(m, bg, memeWeek(m)), SHARE_W, SHARE_H);
};
