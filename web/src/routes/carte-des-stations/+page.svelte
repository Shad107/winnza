<script lang="ts">
  // Carte des stations-service : chaque station, son prix du jour et sa variation sur 7 jours.
  import Toggle from '#lib/components/Toggle.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import StationsMap from '#lib/components/StationsMap.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { longDate } from '#lib/format.ts';
  import { MAP_MODE, type MapMode } from '#lib/map-mode.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import type { StationsMap as StationsData } from '@winnza/core/pages/stations-map.js';

  let { data } = $props();
  const fuels = $derived(data.page.stations?.fuels ?? []);
  let fuelId = $state('gazole');
  let mode = $state<MapMode>(MAP_MODE.price);
  let loaded = $state<NonNullable<StationsData> | null>(null);
  let legend = $state<{ color: string; text: string }[]>([]);
  let mapRef = $state<ReturnType<typeof StationsMap>>();
  let cp = $state('');
  let cpMessage = $state('');
  let zoomTo = $state<[number, number, number, number] | null>(null);
  const hasChange = $derived(loaded?.compareDate != null);

  function search(e: SubmitEvent) {
    e.preventDefault();
    const code = cp.trim();
    if (!/^\d{5}$/.test(code)) { cpMessage = 'Un code postal a cinq chiffres.'; return; }
    const b = mapRef?.boundsOfPostcode(code) ?? null;
    cpMessage = b ? '' : `Aucune station au code postal ${code}.`;
    if (b) zoomTo = b;
  }

  const faq = [
    { q: 'Comment trouver la station la moins chère près de chez moi ?', a: "Choisissez votre carburant, puis tapez votre code postal ou touchez le bouton de localisation. Les pastilles les plus claires sont les stations les moins chères ; touchez-en une pour voir tous ses prix." },
    { q: 'Les prix sont-ils à jour ?', a: "Ils viennent du flux officiel où chaque station déclare ses prix, relevé chaque matin. Une station qui n'a pas mis son prix à jour depuis plus d'une semaine apparaît en gris : son prix réel peut être différent." },
    { q: 'Le prix a-t-il monté ou baissé dans ma station ?', a: "Le mode « Variation sur 7 jours » colore chaque station selon l'évolution de son prix sur une semaine : bleu quand il baisse, rouge quand il monte, gris quand il ne bouge pas." },
  ];
</script>

<Seo site={data.site} page={{ path: '/carte-des-stations', title: 'Carte des stations-service : le prix du carburant près de chez vous | Winnza',
  description: "Chaque station-service de France sur une carte, avec le prix du jour du gazole, du SP95, de l'E10, du SP98, de l'E85 et du GPL, et l'évolution sur 7 jours. Prix officiels, sans compte.",
  faq, modified: data.page.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Chaque station de France, prix officiels du jour</p>
    <h1 class="h1" id="titre">Le prix du carburant près de chez vous</h1>
    <p class="intro">Zoomez jusqu'à votre rue : chaque pastille est une station, colorée selon son prix. Touchez-la pour voir tous ses prix.</p>
    <div class="controls">
      <Toggle label="Carburant" bind:value={fuelId} options={fuels.map((f) => ({ id: f.id, label: f.label }))} />
      {#if hasChange}<Toggle label="Couleur" bind:value={mode} options={[{ id: MAP_MODE.price, label: 'Prix du jour' }, { id: MAP_MODE.change, label: 'Variation sur 7 jours' }]} />{/if}
    </div>
    <form class="cp" onsubmit={search}>
      <label for="cp">Code postal</label>
      <input id="cp" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="35000" bind:value={cp} />
      <button type="submit">Voir</button>
      {#if cpMessage}<span class="msg" role="status">{cpMessage}</span>{/if}
    </form>
  </section>

  <section class="section" aria-label="Carte" style="padding-top: 20px">
    <StationsMap bind:this={mapRef} {fuelId} {mode} {zoomTo} onloaded={(m) => (loaded = m)} onlegend={(l) => (legend = l)} />
    {#if legend.length}
      <div class="legend" aria-label="Légende">
        {#each legend as l (l.text)}<span class="key"><span class="sw" style:background={l.color}></span>{l.text}</span>{/each}
      </div>
    {/if}
    <p class="caption">
      {#if loaded}{loaded.features.length.toLocaleString('fr-FR')} stations, prix relevés le {longDate(loaded.date)}.{/if}
      {#if !hasChange}La variation sur 7 jours de chaque station apparaîtra dès qu'une semaine de relevés sera disponible.{/if}
      Source : flux officiel des prix des carburants (ministère de l'Économie). Fond de carte : © contributeurs OpenStreetMap, Protomaps, servi par Winnza : votre navigateur ne contacte aucun autre site. <a href="/prix-par-departement">Les prix par département</a>.
    </p>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .cp { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 18px; }
  .cp label { font-weight: 600; font-size: 15px; }
  .cp input { width: 110px; min-height: 44px; border: 1px solid var(--line); border-radius: 12px; padding: 0 12px; font: 16px 'Inter Variable', system-ui, sans-serif; background: var(--card); color: var(--ink); }
  .cp button { min-height: 44px; border: 0; border-radius: 12px; padding: 0 18px; font: 700 15px 'Inter Variable', system-ui, sans-serif; background: #2a78d6; color: #ffffff; cursor: pointer; }
  .msg { font-size: 14px; color: var(--ink2); }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 13px; color: var(--ink2); }
  .key { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 12px; height: 12px; border-radius: 50%; }
</style>
