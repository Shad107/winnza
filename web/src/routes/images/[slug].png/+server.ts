// L'image complète d'un mème, celle qu'on partage (dessin : lib/server/meme-svg.ts), rendue en PNG.
// /images/dernier.png : toujours le dernier mème (partage de l'accueil).
import { error } from '@sveltejs/kit';
import { readdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { findMeme, LATEST, memeImageInline, memes } from '#lib/server/memes.ts';
import { MEME_H, MEME_W, memeSvg } from '#lib/server/meme-svg.ts';

// Le dossier de la police est donné explicitement : l'image Docker allégée n'a pas fontconfig, et sans lui
// la recherche « système » ne trouve rien et rend une image SANS TEXTE (constaté le 2026-11-14). Sans police,
// on refuse plutôt que de servir une image vide.
const FONT_DIR = process.env.WINNZA_FONT_DIR ?? '/usr/share/fonts/opentype/inter';
const fontFiles = (() => { try { return readdirSync(FONT_DIR).filter((f) => /\.(otf|ttf)$/.test(f)).map((f) => `${FONT_DIR}/${f}`); } catch { return []; } })();

const cache = new Map<string, Uint8Array<ArrayBuffer>>();
const MAX_CACHED = 20;

export const GET = ({ params }) => {
  const slug = params.slug === LATEST ? memes[0]?.slug : params.slug;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) error(404, 'Image introuvable');
  if (!fontFiles.length) error(500, `Images des mèmes : aucune police dans ${FONT_DIR}`);
  const m = findMeme(slug), bg = memeImageInline(slug);
  if (!m || !bg) error(404, 'Image introuvable');
  // le rendu PNG a besoin de dimensions explicites
  const doc = memeSvg(m, bg).replace('<svg ', `<svg width="${MEME_W}" height="${MEME_H}" `);
  let png = cache.get(doc);
  if (!png) {
    png = new Uint8Array(new Resvg(doc, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng());
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(doc, png);
  }
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } });
};
