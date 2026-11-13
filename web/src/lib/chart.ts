// Géométrie commune aux graphiques : une zone de tracé fixe dans un viewBox 1000 × 340, mise à
// l'échelle par le navigateur. Les deux graphiques de la page partagent axes et échelle verticale.
import { eur2 } from './format';

export const PLOT = { width: 1000, height: 340, x0: 56, x1: 980, y0: 20, y1: 300 } as const;

/** Échelle verticale en euros par litre, de 0 à `max`, arrondie au demi-euro supérieur. */
export function yScale(maxValue: number) {
  const max = Math.max(0.5, Math.ceil(maxValue * 2) / 2);
  const y = (v: number) => PLOT.y1 - (v / max) * (PLOT.y1 - PLOT.y0);
  const ticks: { y: number; label: string }[] = [];
  for (let v = 0.5; v <= max + 1e-9; v += 0.5) ticks.push({ y: y(v), label: eur2(v) });
  return { y, ticks, max };
}

/** Position horizontale de l'infobulle en % de la largeur : à droite du point, ou à gauche près du bord. */
export function tooltipSide(xInViewBox: number): string {
  const pct = (xInViewBox / PLOT.width) * 100;
  return pct > 58 ? `right: ${(100 - pct + 2).toFixed(1)}%` : `left: ${(pct + 2).toFixed(1)}%`;
}
