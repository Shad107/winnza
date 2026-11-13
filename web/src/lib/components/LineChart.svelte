<script lang="ts">
  // Courbes dans le temps : traits de 2 px, fond à ~10 %, point final cerclé. Un réticule suit le
  // pointeur et se cale sur le trimestre le plus proche ; flèches gauche/droite au clavier.
  import { PLOT, tooltipSide, yScale } from '#lib/chart.ts';
  import { eur2 } from '#lib/format.ts';
  import ChartTooltip from './ChartTooltip.svelte';

  type Series = { key: string; label: string; color: string; values: number[] };
  let { labels, series, years, label }: {
    /** libellé de chaque point (ex. « 3e trimestre 2008 ») */
    labels: string[];
    series: Series[];
    /** graduations de l'axe horizontal : index du point et texte */
    years: { index: number; label: string }[];
    label: string;
  } = $props();

  let active = $state<number | null>(null);
  const n = $derived(labels.length);
  const scale = $derived(yScale(Math.max(...series.flatMap((s) => s.values))));
  const x = (i: number) => PLOT.x0 + (i * (PLOT.x1 - PLOT.x0)) / (n - 1);
  const line = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${scale.y(v).toFixed(1)}`).join(' ');
  const area = (vs: number[]) => `${line(vs)} L${PLOT.x1},${PLOT.y1} L${PLOT.x0},${PLOT.y1} Z`;
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i));

  function move(e: PointerEvent) {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * PLOT.width;
    active = clamp(Math.round(((vx - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * (n - 1)));
  }
  function key(e: KeyboardEvent) {
    const cur = active ?? n - 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); active = clamp(cur - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); active = clamp(cur + 1); }
  }
</script>

<div>
  <ul class="legend" aria-hidden="true">
    {#each series as s (s.key)}<li><span style:background={s.color}></span>{s.label}</li>{/each}
  </ul>
  <div class="plot">
    <!-- un curseur : les flèches parcourent les trimestres, la valeur lue est celle du trimestre courant -->
    <svg viewBox="0 0 {PLOT.width} {PLOT.height}" width="100%" tabindex="0" role="slider" aria-label={label}
      aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={active ?? n - 1}
      aria-valuetext={`${labels[active ?? n - 1] ?? ''} : ${series.map((s) => `${s.label} ${eur2(s.values[active ?? n - 1] ?? 0)}`).join(', ')}`}
      onpointermove={move} onpointerleave={() => (active = null)} onkeydown={key}
      onfocus={() => (active ??= n - 1)} onblur={() => (active = null)}>
      {#each scale.ticks as t (t.label)}
        <line x1={PLOT.x0} x2={PLOT.x1} y1={t.y} y2={t.y} class="grid" />
        <text x={PLOT.x0 - 10} y={t.y + 4} text-anchor="end" class="axis">{t.label}</text>
      {/each}
      {#each years as yr (yr.label)}<text x={x(yr.index)} y={PLOT.y1 + 30} text-anchor="middle" class="axis">{yr.label}</text>{/each}
      {#each series as s (s.key)}<path d={area(s.values)} fill={s.color} fill-opacity="0.09" />{/each}
      <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} class="base" />
      {#each series as s (s.key)}
        <path d={line(s.values)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle cx={x(n - 1)} cy={scale.y(s.values[n - 1] ?? 0)} r="5" fill={s.color} stroke="var(--card)" stroke-width="2" />
      {/each}
      {#if active !== null}
        <line x1={x(active)} x2={x(active)} y1={PLOT.y0} y2={PLOT.y1} class="cross" />
        {#each series as s (s.key)}<circle cx={x(active)} cy={scale.y(s.values[active] ?? 0)} r="5" fill={s.color} stroke="var(--card)" stroke-width="2" />{/each}
      {/if}
    </svg>
    {#if active !== null}
      {@const i = active}
      <ChartTooltip title={labels[i] ?? ''} side={tooltipSide(x(i))}
        rows={series.map((s) => ({ key: s.key, color: s.color, value: eur2(s.values[i] ?? 0), label: s.label, line: true }))} />
    {/if}
  </div>
</div>

<style>
  .legend { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 14px; color: var(--ink2); }
  .legend li { display: inline-flex; align-items: center; gap: 8px; }
  .legend span { width: 18px; height: 2px; border-radius: 2px; }
  .plot { position: relative; }
  svg { display: block; touch-action: pan-y; font-family: Inter, system-ui, sans-serif; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .base { stroke: var(--line); stroke-width: 1; }
  .cross { stroke: var(--muted); stroke-width: 1; }
  .axis { font-size: 13px; fill: var(--muted); }
</style>
