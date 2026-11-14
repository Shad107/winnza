<script lang="ts">
  // Les villes d'un département qui ont au moins une station : un lien vers chacune.
  import Icon from '#lib/components/Icon.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import { CITY_PATH } from '@winnza/core/pages/cities.js';

  let { data } = $props();
</script>

<Seo site={data.site} page={{ path: `${CITY_PATH}/departement/${data.dep.code.toLowerCase()}`, title: `Prix du carburant dans les villes de ${data.dep.label} (${data.dep.code}) | Winnza`,
  description: `Le prix du jour du gazole, de l'essence, de l'E85 et du GPL dans les ${data.cities.length} villes de ${data.dep.label} qui ont une station-service. Prix officiels.`,
  faq: [], modified: data.date }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels relevés le {longDate(data.date)}</p>
    <h1 class="h1" id="titre">Le prix du carburant en {data.dep.label}</h1>
    <p class="intro">{data.cities.length} villes de {data.dep.label} ({data.dep.code}) ont au moins une station-service. Choisissez la vôtre.</p>
  </section>
  <section class="section" aria-label="Villes" style="padding-top: 20px">
    <ul class="cities card pad">{#each data.cities as c (c.slug)}<li><a href="{CITY_PATH}/{c.slug}">{c.name}</a>{#if c.stations > 1} <span>{c.stations} stations</span>{/if}</li>{/each}</ul>
    <p class="caption"><a href={CITY_PATH}>Toutes les villes</a> · <a href="/prix-par-departement">La carte des prix par département</a></p>
  </section>
  <NextPages links={PAGES} />
</main>

<style>
  .cities { list-style: none; margin: 0; columns: 3 220px; column-gap: 24px; }
  .cities li { padding: 6px 0; break-inside: avoid; font-size: 15px; }
  .cities span { color: var(--muted); font-size: 13px; }
</style>
