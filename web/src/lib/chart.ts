// Géométrie commune aux graphiques : une zone de tracé fixe dans un viewBox 1000 × 340, mise à
// l'échelle par le navigateur. Les deux graphiques de la page partagent axes et échelle verticale.
import { eur2, eur4 } from './format';

export const PLOT = { width: 1000, height: 340, x0: 56, x1: 980, y0: 20, y1: 300 } as const;

/** Ce qui change d'un graphique à l'autre selon l'unité : le pas des graduations, l'écriture des
 *  graduations et des valeurs, et ce que la valeur mesure (« le litre », « le kWh »). */
export type Axis = { step: number; tick: (v: number) => string; value: (v: number) => string; per: string };
export const AXIS = {
  litre: { step: 0.5, tick: eur2, value: eur2, per: 'le litre' },
  kwh: { step: 0.05, tick: eur2, value: eur4, per: 'le kWh' },
} satisfies Record<string, Axis>;

/** Échelle verticale de 0 à `max`, arrondie à la graduation supérieure. */
export function yScale(maxValue: number, axis: Axis = AXIS.litre) {
  const { step } = axis;
  const max = Math.max(step, Math.ceil(maxValue / step - 1e-9) * step);
  const y = (v: number) => PLOT.y1 - (v / max) * (PLOT.y1 - PLOT.y0);
  const ticks: { y: number; label: string }[] = [];
  for (let i = 1; i * step <= max + 1e-9; i++) ticks.push({ y: y(i * step), label: axis.tick(i * step) });
  return { y, ticks, max };
}

/** Position horizontale de l'infobulle en % de la largeur : à droite du point, ou à gauche près du bord. */
export function tooltipSide(xInViewBox: number): string {
  const pct = (xInViewBox / PLOT.width) * 100;
  return pct > 58 ? `right: ${(100 - pct + 2).toFixed(1)}%` : `left: ${(pct + 2).toFixed(1)}%`;
}
