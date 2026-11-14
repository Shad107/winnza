<script lang="ts">
  // L'index des villes : une recherche, les grandes villes, et un lien par département (chaque département
  // liste ses villes) : c'est par ces liens que les moteurs trouvent chaque ville.
  import Icon from '#lib/components/Icon.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import { CITY_PATH } from '@winnza/core/pages/cities.js';

  let { data } = $props();
  // recherche : la liste des villes n'est chargée qu'à la première frappe (quelques dizaines de Ko)
  let all = $state<[string, string, string][] | null>(null);
  let loading = false;
  let q = $state('');
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  async function ensure() {
    if (all || loading) return;
    loading = true;
    try { const r = await fetch(`${CITY_PATH}/villes.json`); if (r.ok) all = await r.json(); } finally { loading = false; }
  }
  const found = $derived(!all || fold(q).length < 2 ? [] : all.filter(([name, dep]) => fold(name).includes(fold(q)) || dep === q.trim().toUpperCase()).slice(0, 30));
  const depName = (code: string) => data.departments.find((d) => d.code === code)?.label ?? code;

  const faq = [
    { q: 'Comment trouver le prix du carburant dans ma ville ?', a: "Tapez le nom de votre ville ci-dessus, ou choisissez votre département. Chaque page donne le prix moyen du jour de chaque carburant, la station la moins chère et toutes les stations de la ville." },
    { q: "D'où viennent les prix ?", a: "Du flux officiel où chaque station déclare ses prix, relevé chaque jour. Seuls les prix mis à jour dans la semaine comptent dans les moyennes." },
  ];
</script>

<Seo site={data.site} page={{ path: CITY_PATH, title: 'Prix du carburant dans votre ville, aujourd\'hui | Winnza',
  description: `Le prix du gazole, du SP95-E10, du SP98, de l'E85 et du GPL dans ${data.total.toLocaleString('fr-FR')} villes de France, relevé chaque jour, et la station la moins chère. Prix officiels.`,
  faq, modified: data.date }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels relevés le {longDate(data.date)}</p>
    <h1 class="h1" id="titre">Le prix du carburant dans votre ville</h1>
    <p class="intro">{data.total.toLocaleString('fr-FR')} villes qui ont au moins une station-service, avec le prix moyen du jour de chaque carburant et la station la moins chère.</p>
    <div class="search">
      <label for="q">Ma ville</label>
      <input id="q" type="search" placeholder="Rennes, Lyon, Saint-Malo…" autocomplete="address-level2" bind:value={q} onfocus={ensure} oninput={ensure} />
    </div>
    {#if found.length}
      <ul class="found" aria-live="polite">{#each found as [name, dep, slug] (slug)}<li><a href="{CITY_PATH}/{slug}">{name}</a> <span>{depName(dep)} ({dep})</span></li>{/each}</ul>
    {:else if all && fold(q).length >= 2}
      <p class="none" role="status">Aucune ville avec une station ne porte ce nom.</p>
    {/if}
  </section>

  <section class="section" aria-labelledby="grandes">
    <h2 class="h2" id="grandes">Les grandes villes</h2>
    <ul class="chips">{#each data.big as c (c.slug)}<li><a href="{CITY_PATH}/{c.slug}">{c.name}</a></li>{/each}</ul>
  </section>

  <section class="section" aria-labelledby="deps">
    <h2 class="h2" id="deps">Par département</h2>
    <ul class="deps">
      {#each data.departments as d (d.code)}
        <li><a class="card dep" href="{CITY_PATH}/departement/{d.code.toLowerCase()}"><span>{d.label} ({d.code})</span><span class="n">{d.cities} villes</span></a></li>
      {/each}
    </ul>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .search { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 18px; }
  .search label { font-weight: 600; }
  .search input { flex: 1 1 260px; max-width: 420px; min-height: 48px; border: 1px solid var(--line); border-radius: 14px; padding: 0 14px; font: 16px 'Inter Variable', system-ui, sans-serif; background: var(--card); color: var(--ink); }
  .found { list-style: none; margin: 12px 0 0; padding: 0; max-width: 520px; }
  .found li { padding: 10px 0; border-top: 1px solid var(--line); font-size: 15px; }
  .found span, .none { color: var(--muted); font-size: 14px; }
  .chips { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chips a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 999px; background: var(--card); box-shadow: var(--shadow); color: var(--ink); font-weight: 600; text-decoration: none; }
  .deps { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin: 12px 0 0; }
  .dep { min-height: 48px; padding: 8px 16px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-weight: 600; color: var(--ink); text-decoration: none; }
  .dep .n { color: var(--muted); font-weight: 400; font-size: 14px; }
</style>
