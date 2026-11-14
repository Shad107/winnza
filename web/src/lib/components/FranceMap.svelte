<script lang="ts">
  // Carte des départements colorés par prix : cinq classes de même effectif (quintiles), une seule
  // teinte du clair (moins cher) au foncé (plus cher). Survol ou toucher : infobulle du département.
  // Le tableau complet de la page porte les mêmes chiffres pour qui ne voit pas la carte.
  import ChartTooltip from './ChartTooltip.svelte';
  import { eur2 } from '#lib/format.ts';
  import type { DepartmentRow } from '@winnza/core/pages/departments-page.js';

  let { departments, viewBox, fuelId, fuelLabel, france }: {
    departments: DepartmentRow[]; viewBox: [number, number]; fuelId: string; fuelLabel: string; france: number;
  } = $props();

  const CLASSES = ['var(--q1)', 'var(--q2)', 'var(--q3)', 'var(--q4)', 'var(--q5)'] as const;
  const values = $derived(departments.flatMap((d) => (d.prices[fuelId] ? [d.prices[fuelId].avg] : [])).sort((a, b) => a - b));
  /** bornes hautes des quatre premières classes */
  const breaks = $derived([1, 2, 3, 4].map((i) => values[Math.min(values.length - 1, Math.floor((values.length * i) / 5))] ?? 0));
  const classOf = (v: number) => breaks.filter((b) => v >= b).length;
  const colorOf = (v: number): string => CLASSES[classOf(v)] ?? CLASSES[0];
  const legend = $derived(CLASSES.map((color, i) => ({
    color, from: i === 0 ? values[0] : breaks[i - 1], to: i === CLASSES.length - 1 ? values.at(-1) : breaks[i],
  })));

  let active = $state<string | null>(null);
  let pos = $state({ x: 0, y: 0 });
  let box: HTMLDivElement | undefined = $state();
  const hovered = $derived(departments.find((d) => d.code === active));

  // un seul écouteur sur le cadre : le département visé se lit sur l'élément touché
  function show(e: PointerEvent) {
    const code = e.target instanceof Element ? e.target.getAttribute('data-code') : null;
    if (!box || !code) { active = null; return; }
    const r = box.getBoundingClientRect();
    pos = { x: e.clientX - r.left, y: e.clientY - r.top };
    active = code;
  }
  const side = $derived(box && pos.x > box.clientWidth / 2 ? `right: ${box.clientWidth - pos.x + 16}px; top: ${pos.y + 12}px` : `left: ${pos.x + 16}px; top: ${pos.y + 12}px`);
  const diff = (v: number) => {
    const c = Math.round((v - france) * 100);
    return c === 0 ? 'comme la moyenne nationale' : `${c > 0 ? '+' : '−'}${Math.abs(c)} centime${Math.abs(c) > 1 ? 's' : ''} par rapport à la moyenne nationale`;
  };
</script>

<div class="map" bind:this={box} role="presentation" onpointermove={show} onpointerdown={show} onpointerleave={() => (active = null)}>
  <svg viewBox="0 0 {viewBox[0]} {viewBox[1]}" role="img" aria-label="Carte du prix moyen du {fuelLabel.toLowerCase()} par département, de {eur2(values[0] ?? 0)} à {eur2(values.at(-1) ?? 0)} le litre. Le tableau qui suit donne chaque département.">
    {#each departments as d (d.code)}
      {@const p = d.prices[fuelId]}
      <path d={d.d} fill={p ? colorOf(p.avg) : 'var(--soft)'} class="dep" data-code={d.code} />
    {/each}
    {#if hovered}<path d={hovered.d} class="outline" />{/if}
  </svg>
  {#if hovered}
    {@const p = hovered.prices[fuelId]}
    <ChartTooltip title="{hovered.label} ({hovered.code})" {side}
      rows={p ? [{ key: 'avg', color: colorOf(p.avg), value: eur2(p.avg), label: `le litre, ${p.stations} station${p.stations > 1 ? 's' : ''}` }] : []}
      footer={p ? diff(p.avg) : 'Pas de prix relevé ce jour'} />
  {/if}
</div>

<div class="legend" aria-label="Légende : prix du litre">
  {#each legend as l, i (i)}
    <span class="key"><span class="sw" style:background={l.color}></span>{eur2(l.from ?? 0)} à {eur2(l.to ?? 0)}</span>
  {/each}
</div>

<style>
  .map { position: relative; max-width: 620px; margin: 0 auto; touch-action: manipulation; }
  svg { display: block; width: 100%; height: auto; }
  /* liseré de la couleur du fond entre deux départements : ils restent distincts quelle que soit la classe */
  .dep { stroke: var(--card); stroke-width: 1; stroke-linejoin: round; cursor: pointer; }
  .outline { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; pointer-events: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: center; margin-top: 16px; font-size: 13px; color: var(--ink2); }
  .key { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 14px; height: 14px; border-radius: 4px; }
</style>
