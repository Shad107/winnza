<script lang="ts">
  // Barre segmentée (un tout découpé en parts). 28 px, 2 px d'écart entre parts, coins de 4 px, texte
  // dans la part seulement s'il y tient (sinon la légende et l'infobulle le portent).
  import { LITRE_PARTS, PART_META, type LitrePart } from '#lib/parts.ts';

  let { values, texts, scale = 1, label }: {
    values: Record<LitrePart, number>;
    /** texte à imprimer dans chaque part, ou '' pour ne rien imprimer */
    texts: Record<LitrePart, string>;
    /** largeur de la barre, de 0 à 1, pour comparer deux barres à la même échelle */
    scale?: number;
    label: string;
  } = $props();
</script>

<div class="bar" role="img" aria-label={label} style:width="{(scale * 100).toFixed(2)}%">
  {#each LITRE_PARTS as k (k)}
    <div class="seg" title="{PART_META[k].label} : {texts[k]}" style:flex-grow={values[k]} style:background={PART_META[k].color} style:color={PART_META[k].ink}>
      {texts[k]}
    </div>
  {/each}
</div>

<style>
  .bar { display: flex; gap: 2px; height: 28px; min-width: 0; }
  /* pas d'overflow: hidden : couper un chiffre est pire que ne pas l'afficher ; l'appelant ne passe un
     texte que pour une part assez large (voir fitText) */
  .seg { flex: 1 1 0; min-width: 0; border-radius: 4px; font-size: 13px; font-weight: 700; display: flex; align-items: center; padding-left: 8px; white-space: nowrap; }
</style>
