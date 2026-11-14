<script lang="ts">
  // Les analyses : ce qui a vraiment bougé, avec les chiffres de Winnza. Rédigées par l'IA du site.
  import Icon from '#lib/components/Icon.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
</script>

<Seo site={data.site} page={{ path: '/analyses', title: 'Analyses : ce qui a bougé dans le prix de l\'énergie | Winnza',
  description: "Quand le prix du carburant ou de l'électricité bouge vraiment, l'analyse de Winnza, avec les chiffres officiels relevés chaque jour.",
  faq: [], modified: data.list[0]?.date ?? data.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.spark} size={16} />Rédigées par l'IA de Winnza, chiffres officiels</p>
    <h1 class="h1" id="titre">Les analyses</h1>
    <p class="intro">Seulement quand quelque chose bouge vraiment : un record, une hausse ou une baisse nette, une taxe ou un tarif qui change. Chaque chiffre vient de nos relevés.</p>
  </section>
  <section class="section" aria-label="Liste" style="padding-top: 20px">
    {#if data.list.length}
      <ul class="list">
        {#each data.list as a (a.slug)}
          <li class="card item"><a href="/analyses/{a.slug}"><span class="d">{longDate(a.date)}</span><strong>{a.title}</strong><span class="s">{a.description}</span></a></li>
        {/each}
      </ul>
    {:else}
      <p class="lead">Pas encore d'analyse : la première paraîtra quand les prix bougeront assez pour qu'elle vaille la peine.</p>
    {/if}
  </section>
  <NextPages links={PAGES} />
</main>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .item a { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px; color: var(--ink); text-decoration: none; }
  .d { font-size: 13px; color: var(--muted); }
  .s { font-size: 15px; color: var(--ink2); line-height: 1.5; }
</style>
