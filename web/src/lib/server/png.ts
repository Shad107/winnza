// Rendu d'un dessin SVG en PNG (images des mèmes et aperçus pour les réseaux sociaux), avec la police Inter.
// Le dossier de la police est donné explicitement : l'image Docker allégée n'a pas fontconfig, et sans lui
// la recherche « système » ne trouve rien et rend une image SANS TEXTE (constaté le 2026-11-14). Sans police,
// on refuse plutôt que de servir une image vide.
import { error } from '@sveltejs/kit';
import { readdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const FONT_DIR = process.env.WINNZA_FONT_DIR ?? '/usr/share/fonts/opentype/inter';
const fontFiles = (() => { try { return readdirSync(FONT_DIR).filter((f) => /\.(otf|ttf)$/.test(f)).map((f) => `${FONT_DIR}/${f}`); } catch { return []; } })();

const cache = new Map<string, Uint8Array<ArrayBuffer>>();
const MAX_CACHED = 40;

/** `svg` : un dessin avec viewBox ; il est rendu à `width` × `height` pixels. */
export function pngResponse(svg: string, width: number, height: number): Response {
  if (!fontFiles.length) error(500, `Images : aucune police dans ${FONT_DIR}`);
  const doc = svg.replace('<svg ', `<svg width="${width}" height="${height}" `);
  let png = cache.get(doc);
  if (!png) {
    png = new Uint8Array(new Resvg(doc, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng());
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(doc, png);
  }
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } });
}
