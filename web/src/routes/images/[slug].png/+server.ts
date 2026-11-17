// L'image complète d'un mème, celle qu'on télécharge (dessin : lib/server/meme-svg.ts), rendue en PNG.
// /images/dernier.png : toujours le dernier mème.
import { error } from '@sveltejs/kit';
import { findMeme, LATEST, memeImageInline, memes } from '#lib/server/memes.ts';
import { MEME_H, MEME_W, memeSvg } from '#lib/server/meme-svg.ts';
import { pngResponse } from '#lib/server/png.ts';

export const GET = ({ params }) => {
  const slug = params.slug === LATEST ? memes[0]?.slug : params.slug;
  const m = slug ? findMeme(slug) : null, bg = slug ? memeImageInline(slug) : null;
  if (!m || !bg) error(404, 'Image introuvable');
  return pngResponse(memeSvg(m, bg), MEME_W, MEME_H);
};
