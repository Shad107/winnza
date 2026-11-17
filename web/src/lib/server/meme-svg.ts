// Le dessin d'un mème : l'image de fond de l'IA, les deux légendes posées dessus, et un bandeau qui dit que
// c'est de la satire et d'où vient la vraie information. Un seul dessin pour la page (SVG dans le HTML, fond
// en JPEG servi à part) et pour l'image qu'on partage (même SVG, fond intégré, rendu en PNG) : ils ne
// peuvent pas diverger.
import type { Meme } from '@winnza/core/pages/memes.js';

/** Dimensions : l'image de fond (3:2) puis le bandeau. */
export const MEME_W = 1200, MEME_IMG_H = 800, MEME_BAND_H = 80;
export const MEME_H = MEME_IMG_H + MEME_BAND_H;
/** légendes : taille, interligne, coupure, et ligne de base de la première (haut) ou de la dernière (bas) */
const CAPTION = { size: 58, lineHeight: 66, maxChars: 32, maxLines: 2, topBaseline: 86, bottomBaseline: MEME_IMG_H - 36 } as const;
/** bandeau : au-delà, le nom du média est coupé (il reste complet sous le mème, sur la page) */
const BAND_MAX_CHARS = 90;
/** les couleurs du dessin (celles du site : app.css) ; le PNG ne lit pas le CSS, d'où cette copie unique */
const INK = '#0f1012', BAND = '#141518', GREY = '#c4c6ca', WHITE = '#ffffff';

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** coupe un texte en lignes d'au plus `max` caractères, au plus `lines` lignes */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out.length > lines ? [...out.slice(0, lines - 1), out.slice(lines - 1).join(' ')] : out;
}

/** une légende de mème : capitales, blanc cerclé de noir, lisible sur n'importe quel fond */
function caption(text: string, edge: 'top' | 'bottom'): string {
  const lines = wrap(text.toUpperCase(), CAPTION.maxChars, CAPTION.maxLines);
  const baseline = (i: number) => edge === 'top' ? CAPTION.topBaseline + i * CAPTION.lineHeight : CAPTION.bottomBaseline - (lines.length - 1 - i) * CAPTION.lineHeight;
  return lines.map((l, i) => `<text x="${MEME_W / 2}" y="${baseline(i)}" text-anchor="middle" font-size="${CAPTION.size}" font-weight="800" fill="${WHITE}" stroke="${INK}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">${xml(l)}</text>`).join('');
}

/** `background` : adresse de l'image de fond (URL publique, ou data: URI pour le rendu en PNG). */
export function memeSvg(m: Meme, background: string): string {
  const source = `La vraie info : ${m.source.media}`;
  const band = source.length > BAND_MAX_CHARS ? source.slice(0, BAND_MAX_CHARS - 1) + '…' : source;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MEME_W} ${MEME_H}" font-family="Inter, 'Inter Variable', sans-serif">
    <rect width="${MEME_W}" height="${MEME_H}" fill="${INK}"/>
    <image href="${xml(background)}" x="0" y="0" width="${MEME_W}" height="${MEME_IMG_H}" preserveAspectRatio="xMidYMid slice"/>
    ${caption(m.top, 'top')}${caption(m.bottom, 'bottom')}
    <rect x="0" y="${MEME_IMG_H}" width="${MEME_W}" height="${MEME_BAND_H}" fill="${BAND}"/>
    <text x="24" y="${MEME_IMG_H + 33}" font-size="21" font-weight="700" fill="${WHITE}">winnza.eu · site satirique</text>
    <text x="24" y="${MEME_IMG_H + 62}" font-size="18" fill="${GREY}">${xml(band)}</text>
  </svg>`;
}
