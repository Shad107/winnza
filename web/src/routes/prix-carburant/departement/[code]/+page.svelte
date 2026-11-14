<script lang="ts">
  // Les villes d'un département qui ont au moins une station : un lien vers chacune.
  import Icon from '#lib/components/Icon.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur3, longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import { CITY_PATH } from '@winnza/core/pages/cities.js';

  let { data } = $props();
</script>

<Seo site={data.site} page={{ path: `${CITY_PATH}/departement/${data.dep.code.toLowerCase()}`, title: `Prix du carburant en ${data.dep.label} (${data.dep.code}) aujourd'hui, ville par ville | Winnza`,
  description: `${data.dep.fuels[0] ? `${data.dep.fuels[0].label} à ${eur3(data.dep.fuels[0].avg)} en moyenne en ${data.dep.label} aujourd'hui. ` : ''}Le prix du jour du gazole, de l'essence, de l'E85 et du GPL dans les ${data.cities.length} villes de ${data.dep.label} qui ont une station-service. Prix officiels.`,
  faq: [], modified: data.date }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels relevés le {longDate(data.date)}</p>
    <h1 class="h1" id="titre">Le prix du carburant en {data.dep.label}</h1>
    <p class="intro">{data.cities.length} villes de {data.dep.label} ({data.dep.code}) ont au moins une station-service. Choisissez la vôtre.</p>
    {#if data.dep.fuels.length}
      <ul class="avgs">{#each data.dep.fuels as f (f.id)}<li><span>{f.label}</span><strong>{eur3(f.avg)}</strong></li>{/each}</ul>
      <p class="caption">Prix moyen du jour dans le département, sur les prix mis à jour dans la semaine.</p>
    {/if}
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
  .avgs { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
  .avgs li { display: flex; flex-direction: column; padding: 12px 16px; border-radius: 16px; background: var(--card); box-shadow: var(--shadow); min-width: 140px; }
  .avgs span { font-size: 13px; color: var(--muted); }
  .avgs strong { font-size: 22px; font-weight: 800; }
</style>
