// L'image de partage d'une page (1200 × 630, ce qu'affichent les réseaux sociaux) : l'accroche écrite par
// l'IA rédactrice (ou le titre de la rubrique), et le chiffre du jour tiré de la base. /partage/accueil.png
// pour l'accueil, /partage/<chemin>.png pour les autres pages.
import { error } from '@sveltejs/kit';
import { readdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { shareFigure, SHARE_UNIT, type ShareFigure, type ShareUnit } from '@winnza/core/pages/share.js';
import { CITY_PATH } from '@winnza/core/pages/cities.js';
import { cityPage, seoOverrides, siteDecl, withReadStore } from '#lib/server/data.ts';
import { SECTIONS } from '#lib/site-nav.ts';
import { eur2, eur3, eur4, longDate } from '#lib/format.ts';

const W = 1200, H = 630;
/** l'accueil n'a pas de nom dans son chemin */
const HOME = 'accueil';
const FORMAT = {
  [SHARE_UNIT.eurPerLitre]: eur3, [SHARE_UNIT.eurPerKwh]: eur4, [SHARE_UNIT.eur]: eur2,
  [SHARE_UNIT.usd]: (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`,
} satisfies Record<ShareUnit, (v: number) => string>;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** coupe un texte en lignes d'au plus `max` caractères, au plus `lines` lignes */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out.length > lines ? [...out.slice(0, lines - 1), out.slice(lines - 1).join(' ').slice(0, max - 1) + '…'] : out;
}

function svg(kicker: string, headline: string, figure: ShareFigure | null): string {
  const lines = wrap(headline, 30, 3);
  const head = lines.map((l, i) => `<text x="72" y="${236 + i * 70}" font-size="60" font-weight="800" fill="#111418">${xml(l)}</text>`).join('');
  const fig = figure ? `<text x="72" y="520" font-size="92" font-weight="800" fill="#2a78d6">${xml(FORMAT[figure.unit](figure.value))}</text>
    <text x="72" y="562" font-size="28" fill="#454b55">${xml(figure.label)}</text>` : '';
  const date = figure ? `chiffres officiels du ${longDate(figure.date)}` : 'chiffres officiels';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter">
    <rect width="${W}" height="${H}" fill="#f3f5f8"/>
    <rect x="36" y="36" width="${W - 72}" height="${H - 72}" rx="32" fill="#ffffff"/>
    <text x="72" y="118" font-size="40" font-weight="800" fill="#2a78d6">Winnza</text>
    <text x="72" y="164" font-size="28" fill="#5f6670">${xml(kicker)}</text>
    ${head}${fig}
    <text x="${W - 72}" y="118" font-size="24" fill="#5f6670" text-anchor="end">winnza.eu · ${xml(date)}</text>
  </svg>`;
}

// Le dossier de la police est donné explicitement : l'image Docker allégée n'a pas fontconfig, et sans lui
// la recherche « système » ne trouve rien et rend une image SANS TEXTE (constaté le 2026-11-14). Sans police,
// on refuse plutôt que de servir une image vide.
const FONT_DIR = process.env.WINNZA_FONT_DIR ?? '/usr/share/fonts/opentype/inter';
const fontFiles = (() => { try { return readdirSync(FONT_DIR).filter((f) => /\.(otf|ttf)$/.test(f)).map((f) => `${FONT_DIR}/${f}`); } catch { return []; } })();

const cache = new Map<string, Uint8Array<ArrayBuffer>>();
const MAX_CACHED = 300;

export const GET = ({ params }) => {
  const path = params.page.replace(/\.png$/, '');
  if (!/^[a-z0-9/-]+$/.test(path)) error(404, 'Image introuvable');
  const page = path === HOME ? '/' : `/${path}`;
  const override = seoOverrides()[page];
  const section = SECTIONS.find((s) => s.href === page);
  let kicker = section?.label ?? siteDecl().name, headline = override?.shareText ?? section?.title ?? siteDecl().name;
  let figure: ShareFigure | null;
  if (page.startsWith(`${CITY_PATH}/`)) {
    const c = cityPage(page.slice(CITY_PATH.length + 1));
    if (!c) error(404, 'Image introuvable');
    const f = c.city.fuels[0];
    kicker = `${c.city.name} (${c.city.dep})`;
    headline = `Le prix du carburant à ${c.city.name} aujourd'hui`;
    figure = f ? { value: f.avg, unit: SHARE_UNIT.eurPerLitre, label: `le litre de ${f.label.toLowerCase()} en moyenne`, date: c.date } : null;
  } else {
    if (!section && page !== '/') error(404, 'Image introuvable');
    figure = withReadStore((s) => shareFigure(page, s));
  }
  const key = `${page}|${headline}|${figure?.date ?? ''}|${figure?.value ?? ''}`;
  if (!fontFiles.length) error(500, `Images de partage : aucune police dans ${FONT_DIR}`);
  let png = cache.get(key);
  if (!png) {
    png = new Uint8Array(new Resvg(svg(kicker, headline, figure), { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng());
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(key, png);
  }
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } });
};
