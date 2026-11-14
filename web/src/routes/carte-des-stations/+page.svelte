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
  import { nearby } from '@winnza/core/pages/nearby.js';
  import { eur2, eur0 } from '#lib/format.ts';

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

  // « Autour de vous » : position acceptée par le visiteur ou code postal ; calculé ici, rien n'est envoyé
  let here = $state<{ lon: number; lat: number; label: string } | null>(null);
  let locating = $state(false);
  const FILL_LITRES = 50;
  const around = $derived(loaded && here ? nearby(loaded.features, fuelId, here.lon, here.lat) : null);
  const fuelLabel = $derived(fuels.find((f) => f.id === fuelId)?.label.toLowerCase() ?? '');
  const franceAvg = $derived(fuels.find((f) => f.id === fuelId)?.avg ?? null);
  const km = (v: number) => (v < 1 ? `${Math.round(v * 1000 / 50) * 50} m` : `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`);
  function locateMe() { locating = true; cpMessage = ''; if (!mapRef?.locate()) { locating = false; cpMessage = "La localisation n'est pas disponible sur cet appareil : utilisez votre code postal."; } }
  function showStation(lon: number, lat: number) { zoomTo = [lon - 0.004, lat - 0.003, lon + 0.004, lat + 0.003]; }

  function search(e: SubmitEvent) {
    e.preventDefault();
    const code = cp.trim();
    if (!/^\d{5}$/.test(code)) { cpMessage = 'Un code postal a cinq chiffres.'; return; }
    const b = mapRef?.boundsOfPostcode(code) ?? null;
    cpMessage = b ? '' : `Aucune station au code postal ${code}.`;
    if (b) { zoomTo = b; here = { lon: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2, label: `autour du ${code}` }; }
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
      <span class="or">ou</span>
      <button type="button" class="ghost" onclick={locateMe} disabled={locating}>{locating ? 'Localisation…' : 'Autour de moi'}</button>
      {#if cpMessage}<span class="msg" role="status">{cpMessage}</span>{/if}
    </form>
  </section>

  <section class="section" aria-label="Carte" style="padding-top: 20px">
    {#if around}
      <div class="card pad near" aria-live="polite">
        <h2 class="h3">Le {fuelLabel} {here?.label}</h2>
        <p class="sum">
          <strong>{eur2(around.average)}</strong> le litre en moyenne dans {around.count} station{around.count > 1 ? 's' : ''} à moins de {around.radiusKm} km{#if franceAvg !== null}, {around.average < franceAvg ? 'moins' : 'plus'} cher que la moyenne nationale ({eur2(franceAvg)}){/if}.
          {#if around.dearest - around.cheapest[0]!.price >= 0.01}La moins chère vous fait gagner <strong>{eur0((around.dearest - around.cheapest[0]!.price) * FILL_LITRES)}</strong> sur un plein de {FILL_LITRES} litres par rapport à la plus chère du coin.{/if}
        </p>
        <ol class="near-list">
          {#each around.cheapest as st (st.key)}
            <li><button type="button" onclick={() => showStation(st.lon, st.lat)}>
              <span class="where"><span class="addr">{st.address || 'Adresse non renseignée'}</span><span class="city">{st.city} · {km(st.km)}</span></span>
              <strong>{eur2(st.price)}</strong>
            </button></li>
          {/each}
        </ol>
        <p class="caption">Votre position reste dans votre navigateur : elle n'est ni envoyée ni enregistrée.</p>
      </div>
    {:else if here && loaded}
      <div class="card pad near"><p class="sum">Aucune station à jour à moins de 10 km {here.label} pour ce carburant.</p></div>
    {/if}
    <StationsMap bind:this={mapRef} {fuelId} {mode} {zoomTo} onloaded={(m) => (loaded = m)} onlegend={(l) => (legend = l)}
      onlocated={(lon, lat) => { here = { lon, lat, label: 'autour de vous' }; locating = false; }}
      onlocateerror={() => { locating = false; cpMessage = 'Position non disponible (refusée ou introuvable) : utilisez votre code postal.'; }} />
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
  .or { color: var(--muted); font-size: 14px; }
  .cp .ghost { background: var(--card); color: var(--ink); box-shadow: var(--shadow); border: 1px solid var(--line); }
  .near { margin-bottom: 16px; }
  .h3 { margin: 0; font-size: 20px; letter-spacing: -0.3px; }
  .sum { margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: var(--ink2); }
  .near-list { list-style: none; margin: 12px 0 0; padding: 0; }
  .near-list li { border-top: 1px solid var(--line); }
  .near-list button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; padding: 8px 0;
    border: 0; background: none; color: var(--ink); font: 15px 'Inter Variable', system-ui, sans-serif; text-align: left; cursor: pointer; }
  .where { display: flex; flex-direction: column; min-width: 0; }
  .addr { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .city { font-size: 13px; color: var(--muted); }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 13px; color: var(--ink2); }
  .key { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 12px; height: 12px; border-radius: 50%; }
</style>
