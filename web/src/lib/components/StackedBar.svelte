<script lang="ts">
  // Barre segmentée (un tout découpé en parts). 28 px, 2 px d'écart entre parts, coins de 4 px, texte
  // dans la part seulement s'il y tient (sinon la légende et l'infobulle le portent).
  import type { Segment } from '#lib/parts.ts';

  let { parts, values, texts, scale = 1, label }: {
    /** les parts, dans l'ordre (litre, kWh...) : le composant ne sait pas ce qu'il découpe */
    parts: readonly Segment[];
    values: Record<string, number>;
    /** texte à imprimer dans chaque part, ou '' pour ne rien imprimer */
    texts: Record<string, string>;
    /** largeur de la barre, de 0 à 1, pour comparer deux barres à la même échelle */
    scale?: number;
    label: string;
  } = $props();
  // parts ramenées à des pourcentages : avec des valeurs dont la somme est sous 1 (un kWh à 0,20 €), flex-grow
  // ne distribuerait qu'une fraction de la largeur et la barre resterait courte
  const total = $derived(parts.reduce((s, p) => s + Math.max(0, values[p.key] ?? 0), 0) || 1);
</script>

<div class="bar" role="img" aria-label={label} style:width="{(scale * 100).toFixed(2)}%">
  {#each parts as p (p.key)}
    <div class="seg" title="{p.label} : {texts[p.key] ?? ''}" style:flex-grow={(Math.max(0, values[p.key] ?? 0) / total) * 100} style:background={p.color} style:color={p.ink}>
      {texts[p.key] ?? ''}
    </div>
  {/each}
</div>

<style>
  .bar { display: flex; gap: 2px; height: 28px; min-width: 0; }
  /* pas d'overflow: hidden : couper un chiffre est pire que ne pas l'afficher ; l'appelant ne passe un
     texte que pour une part assez large (voir fitText) */
  .seg { flex: 1 1 0; min-width: 0; border-radius: 4px; font-size: 13px; font-weight: 700; display: flex; align-items: center; padding-left: 8px; white-space: nowrap; }
</style>
