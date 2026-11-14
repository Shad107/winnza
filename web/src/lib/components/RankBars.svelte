<script lang="ts">
  // Classement à barres horizontales : un libellé, une barre proportionnelle, la valeur écrite. La barre
  // n'est qu'un repère : la valeur est toujours écrite en clair, et la liste est lue dans l'ordre.
  export type RankItem = {
    key: string; label: string;
    /** grandeur de la barre (même unité pour toutes les lignes) */
    value: number;
    /** valeur affichée, déjà mise en forme */
    text: string;
    /** précision sous le libellé */
    sub?: string;
    /** ligne mise en avant (la France, le moins cher...) */
    highlight?: boolean;
    /** couleur de drapeau, si la ligne est un pays */
    flag?: string;
  };
  let { items, label }: { items: RankItem[]; label: string } = $props();
  const max = $derived(Math.max(...items.map((i) => i.value), 0) || 1);
</script>

<ol class="ranking" aria-label={label}>
  {#each items as it (it.key)}
    <li class:home={it.highlight}>
      <span class="r-name">
        <span class="r-title">{#if it.flag}<span class="flag" style:background={it.flag} aria-hidden="true"></span>{/if}{it.label}</span>
        {#if it.sub}<span class="r-sub">{it.sub}</span>{/if}
      </span>
      <span class="r-bar" aria-hidden="true"><span style:width="{((Math.max(0, it.value) / max) * 100).toFixed(1)}%"></span></span>
      <span class="r-value">{it.text}</span>
    </li>
  {/each}
</ol>

<style>
  .ranking { list-style: none; margin: 0; padding: 0; }
  .ranking li { display: grid; grid-template-columns: minmax(120px, 2fr) 3fr auto; align-items: center; gap: 4px 12px; padding: 8px 0; font-size: 14px; }
  .ranking li.home { font-weight: 800; }
  .r-name { display: flex; flex-direction: column; min-width: 0; }
  .r-title { display: inline-flex; align-items: center; gap: 8px; }
  .r-sub { font-size: 12px; color: var(--muted); font-weight: 400; }
  .flag { width: 22px; height: 15px; border-radius: 3px; box-shadow: 0 0 0 1px var(--line); flex: 0 0 auto; }
  .r-bar { height: 10px; background: var(--soft); border-radius: 999px; overflow: hidden; }
  .r-bar span { display: block; height: 100%; background: var(--q3); border-radius: 999px; }
  .ranking li.home .r-bar span { background: var(--s2); }
  .r-value { font-variant-numeric: tabular-nums; text-align: right; }
  /* écran étroit : la barre passe sous le libellé, sur toute la largeur (dépend de l'écran, jamais du contenu) */
  @media (max-width: 560px) {
    .ranking li { grid-template-columns: 1fr auto; }
    .r-name { grid-column: 1; grid-row: 1; }
    .r-value { grid-column: 2; grid-row: 1; }
    .r-bar { grid-column: 1 / -1; grid-row: 2; }
  }
</style>
