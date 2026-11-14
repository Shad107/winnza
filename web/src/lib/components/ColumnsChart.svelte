<script lang="ts">
  // Colonnes empilées, une par année : les parts d'un litre ou d'un kWh. Colonnes de 24 px max, 2 px
  // d'écart entre parts, sommet arrondi de 4 px, base carrée. Survol ou clavier : détail de l'année.
  import type { Segment } from '#lib/parts.ts';
  import { AXIS, PLOT, tooltipSide, yScale, type Axis } from '#lib/chart.ts';
  import ChartTooltip from './ChartTooltip.svelte';

  let { parts, rows, highlight, label, axis = AXIS.litre }: {
    /** les parts empilées, du bas vers le haut */
    parts: readonly Segment[];
    rows: { year: number; parts: Record<string, number> }[];
    /** années dont le total est écrit au sommet (les autres : infobulle et tableau) */
    highlight: number[];
    label: string;
    axis?: Axis;
  } = $props();

  const BAR = 24, GAP = 2, R = 4;
  let active = $state<number | null>(null);

  const total = (v: Record<string, number>) => parts.reduce((s, p) => s + (v[p.key] ?? 0), 0);
  const scale = $derived(yScale(Math.max(...rows.map((r) => total(r.parts))), axis));
  const slot = $derived((PLOT.x1 - PLOT.x0) / rows.length);

  const columns = $derived(rows.map((r, i) => {
    const cx = PLOT.x0 + slot * (i + 0.5), x = cx - BAR / 2;
    let acc = 0;
    const segs = parts.map((p, j) => {
      const k = p.key, color = p.color;
      const bottom = scale.y(acc);
      acc += r.parts[k] ?? 0;
      const top = scale.y(acc) + (j < parts.length - 1 ? GAP : 0);
      const isTop = j === parts.length - 1;
      const d = isTop
        ? `M${x},${bottom} L${x},${top + R} Q${x},${top} ${x + R},${top} L${x + BAR - R},${top} Q${x + BAR},${top} ${x + BAR},${top + R} L${x + BAR},${bottom} Z`
        : `M${x},${bottom} L${x},${top} L${x + BAR},${top} L${x + BAR},${bottom} Z`;
      return { k, d, color };
    });
    const t = total(r.parts);
    return { i, cx, segs, year: r.year, total: t, topY: scale.y(t) - 8 };
  }));

  const tip = $derived(active === null ? null : rows[active]);
</script>

<div class="wrap-chart">
  <ul class="legend" aria-hidden="true">
    {#each parts as p (p.key)}<li><span style:background={p.color}></span>{p.short}</li>{/each}
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
            tabindex="0" role="button" aria-label="{c.year} : {axis.value(c.total)} {axis.per}"
            onpointerenter={() => (active = c.i)} onpointerleave={() => (active = null)}
            onfocus={() => (active = c.i)} onblur={() => (active = null)} />
          {#each c.segs as s (s.k)}<path d={s.d} fill={s.color} pointer-events="none" />{/each}
          {#if c.year % 5 === 0 || highlight.includes(c.year)}
            <text x={c.cx} y={PLOT.y1 + 20} text-anchor="middle" class="axis">{c.year}</text>
          {/if}
          {#if highlight.includes(c.year)}
            <text x={c.cx} y={c.topY} text-anchor="middle" class="top">{axis.value(c.total)}</text>
          {/if}
        </g>
      {/each}
      <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} class="base" />
    </svg>
    {#if tip && active !== null}
      <ChartTooltip title="Année {tip.year}" side={tooltipSide(columns[active]!.cx)}
        rows={[...parts].reverse().map((p) => ({ key: p.key, color: p.color, value: axis.value(tip.parts[p.key] ?? 0), label: p.short }))}
        footer="{axis.value(total(tip.parts))} {axis.per}" />
    {/if}
  </div>
  <!-- un <table> ignore une largeur de 1 px : c'est son conteneur qui est masqué -->
  <div class="sr-only"><table>
    <caption>{label}</caption>
    <thead><tr><th scope="col">Année</th>{#each parts as p (p.key)}<th scope="col">{p.short}</th>{/each}<th scope="col">Total</th></tr></thead>
    <tbody>{#each rows as r (r.year)}<tr><th scope="row">{r.year}</th>{#each parts as p (p.key)}<td>{axis.value(r.parts[p.key] ?? 0)}</td>{/each}<td>{axis.value(total(r.parts))}</td></tr>{/each}</tbody>
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
