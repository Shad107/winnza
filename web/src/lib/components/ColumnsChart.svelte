<script lang="ts">
  // Colonnes empilées, une par année : les quatre parts d'un litre. Colonnes de 24 px max, 2 px
  // d'écart entre parts, sommet arrondi de 4 px, base carrée. Survol ou clavier : détail de l'année.
  import { LITRE_PARTS, PART_META, type LitrePart } from '#lib/parts.ts';
  import { PLOT, tooltipSide, yScale } from '#lib/chart.ts';
  import { eur2 } from '#lib/format.ts';
  import ChartTooltip from './ChartTooltip.svelte';

  let { rows, highlight, label }: {
    rows: { year: number; parts: Record<LitrePart, number> }[];
    /** années dont le total est écrit au sommet (les autres : infobulle et tableau) */
    highlight: number[];
    label: string;
  } = $props();

  const BAR = 24, GAP = 2, R = 4;
  let active = $state<number | null>(null);

  const total = (p: Record<LitrePart, number>) => LITRE_PARTS.reduce((s, k) => s + p[k], 0);
  const scale = $derived(yScale(Math.max(...rows.map((r) => total(r.parts)))));
  const slot = $derived((PLOT.x1 - PLOT.x0) / rows.length);

  const columns = $derived(rows.map((r, i) => {
    const cx = PLOT.x0 + slot * (i + 0.5), x = cx - BAR / 2;
    let acc = 0;
    const segs = LITRE_PARTS.map((k, j) => {
      const bottom = scale.y(acc);
      acc += r.parts[k];
      const top = scale.y(acc) + (j < LITRE_PARTS.length - 1 ? GAP : 0);
      const isTop = j === LITRE_PARTS.length - 1;
      const d = isTop
        ? `M${x},${bottom} L${x},${top + R} Q${x},${top} ${x + R},${top} L${x + BAR - R},${top} Q${x + BAR},${top} ${x + BAR},${top + R} L${x + BAR},${bottom} Z`
        : `M${x},${bottom} L${x},${top} L${x + BAR},${top} L${x + BAR},${bottom} Z`;
      return { k, d };
    });
    const t = total(r.parts);
    return { i, cx, segs, year: r.year, total: t, topY: scale.y(t) - 8 };
  }));

  const tip = $derived(active === null ? null : rows[active]);
</script>

<div class="wrap-chart">
  <ul class="legend" aria-hidden="true">
    {#each LITRE_PARTS as k (k)}<li><span style:background={PART_META[k].color}></span>{PART_META[k].short}</li>{/each}
  </ul>
  <div class="plot">
    <svg viewBox="0 0 {PLOT.width} {PLOT.height}" width="100%" role="img" aria-label={label}>
      {#each scale.ticks as t (t.label)}
        <line x1={PLOT.x0} x2={PLOT.x1} y1={t.y} y2={t.y} class="grid" />
        <text x={PLOT.x0 - 10} y={t.y + 4} text-anchor="end" class="axis">{t.label}</text>
      {/each}
      {#each columns as c (c.year)}
        <g>
          <rect class="hit" class:on={active === c.i} x={c.cx - slot / 2 + 1} y={PLOT.y0} width={slot - 2} height={PLOT.y1 - PLOT.y0} rx="6"
            tabindex="0" role="button" aria-label="{c.year} : {eur2(c.total)} le litre"
            onpointerenter={() => (active = c.i)} onpointerleave={() => (active = null)}
            onfocus={() => (active = c.i)} onblur={() => (active = null)} />
          {#each c.segs as s (s.k)}<path d={s.d} fill={PART_META[s.k].color} pointer-events="none" />{/each}
          {#if c.year % 5 === 0 || highlight.includes(c.year)}
            <text x={c.cx} y={PLOT.y1 + 20} text-anchor="middle" class="axis">{c.year}</text>
          {/if}
          {#if highlight.includes(c.year)}
            <text x={c.cx} y={c.topY} text-anchor="middle" class="top">{eur2(c.total)}</text>
          {/if}
        </g>
      {/each}
      <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} class="base" />
    </svg>
    {#if tip && active !== null}
      <ChartTooltip title="Année {tip.year}" side={tooltipSide(columns[active]!.cx)}
        rows={[...LITRE_PARTS].reverse().map((k) => ({ key: k, color: PART_META[k].color, value: eur2(tip.parts[k]), label: PART_META[k].short }))}
        footer="{eur2(total(tip.parts))} le litre" />
    {/if}
  </div>
  <!-- un <table> ignore une largeur de 1 px : c'est son conteneur qui est masqué -->
  <div class="sr-only"><table>
    <caption>{label}</caption>
    <thead><tr><th scope="col">Année</th>{#each LITRE_PARTS as k (k)}<th scope="col">{PART_META[k].short}</th>{/each}<th scope="col">Total</th></tr></thead>
    <tbody>{#each rows as r (r.year)}<tr><th scope="row">{r.year}</th>{#each LITRE_PARTS as k (k)}<td>{eur2(r.parts[k])}</td>{/each}<td>{eur2(total(r.parts))}</td></tr>{/each}</tbody>
  </table></div>
</div>

<style>
  .legend { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 14px; color: var(--ink2); }
  .legend li { display: inline-flex; align-items: center; gap: 8px; }
  .legend span { width: 14px; height: 14px; border-radius: 4px; }
  .plot { position: relative; }
  svg { display: block; font-family: 'Inter Variable', system-ui, sans-serif; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .base { stroke: var(--line); stroke-width: 1; }
  .axis { font-size: 12px; fill: var(--muted); }
  .top { font-size: 13px; font-weight: 700; fill: var(--ink); }
  .hit { fill: transparent; outline: none; }
  .hit.on { fill: var(--soft); }
</style>
