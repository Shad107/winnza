<script lang="ts">
  // Accueil : le plein ou le litre découpé, et le prix du jour de chaque carburant.
  import Toggle from '#lib/components/Toggle.svelte';
  import StackedBar from '#lib/components/StackedBar.svelte';
  import PartCard from '#lib/components/PartCard.svelte';
  import Jerrycan from '#lib/components/Jerrycan.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import StationsToday from '#lib/components/StationsToday.svelte';
  import TrendCard from '#lib/components/TrendCard.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { LITRE_PARTS, ICON } from '#lib/parts.ts';
  import { eur2, money, percent, longDate } from '#lib/format.ts';
  import { scaled, sum, allText, shareText, describe } from '#lib/view.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const fuel = $derived(data.page);
  const UNIT = { litre: 'litre', fill: 'fill' } as const;
  type UnitId = (typeof UNIT)[keyof typeof UNIT];

  let productId = $state('diesel');
  let unit = $state<UnitId>(UNIT.litre);
  let litres = $state(50);

  const p = $derived(fuel.products.find((x) => x.id === productId) ?? fuel.products[0]!);
  const name = $derived(p.label.toLowerCase());
  const perLitre = $derived(unit === UNIT.litre);
  const now = $derived(scaled(p.now, perLitre ? 1 : litres));
  const total = $derived(sum(now));
  const taxes = $derived(now.excise + now.vat);

  const faq = [
    { q: 'Qui fixe le prix à la pompe ?', a: "Personne en particulier : en France, chaque station fixe son prix. Mais toutes achètent leur carburant aux mêmes cours, d'où des prix proches d'une station à l'autre. Les taxes, elles, sont les mêmes partout." },
    { q: 'Le carburant va-t-il baisser ?', a: "Le prix à la pompe suit le marché de gros avec environ une semaine de retard. Winnza en tire chaque jour une tendance pour la semaine qui vient, avec le bilan réel de la méthode sur les années passées : voir la page Prévision." },
  ];
</script>

<Seo site={data.site} page={{ path: '/', title: `Prix du carburant : où passe l'argent de votre plein ? | Winnza`,
  description: `Sur ${eur2(fuel.products[0]!.litre)} de ${fuel.products[0]!.label.toLowerCase()}, combien pour le pétrole, la raffinerie, la TICPE et la TVA ? Le prix du jour de chaque carburant, chaque semaine le vrai découpage. Chiffres officiels.`,
  faq, modified: fuel.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <div class="hero-grid">
      <div class="hero-text">
        <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels, mis à jour automatiquement</p>
        <h1 class="h1" id="titre">Où passe l'argent de votre plein&#160;?</h1>
        <p class="intro">Sur chaque litre, une partie paie le pétrole, une autre la raffinerie et la station, le reste part en taxes. Voici combien.</p>
        <div class="controls">
          <Toggle label="Carburant" bind:value={productId} options={fuel.products.map((x) => ({ id: x.id, label: x.label }))} />
          <Toggle label="Afficher" bind:value={unit} options={[{ id: UNIT.litre, label: '1 litre' }, { id: UNIT.fill, label: 'Mon plein' }]} />
        </div>
        {#if !perLitre}
          <div class="slider">
            <label for="litres"><span>Mon plein</span><span>{litres} litres</span></label>
            <input id="litres" type="range" min="20" max="80" step="5" bind:value={litres} />
          </div>
        {/if}
        <div class="headline">
          <span class="big">{money(total, perLitre)}</span>
          <span class="sub">{perLitre ? `le litre de ${name}, moyenne nationale de la semaine du ${longDate(fuel.asOf)}` : `pour ${litres} litres de ${name}, à ${eur2(p.litre)} le litre`}</span>
        </div>
      </div>
      <Jerrycan values={now} texts={allText(now, perLitre)} label={describe(now, perLitre ? `Un litre à ${money(total, true)}` : `Votre plein de ${money(total, false)}`, perLitre)} />
    </div>

    <div class="bar-wrap"><StackedBar values={now} texts={shareText(now, total)} label={describe(now, 'Répartition', perLitre)} /></div>
    <div class="grid-cards parts">
      {#each LITRE_PARTS as key (key)}<PartCard part={key} value={money(now[key], perLitre)} share={percent(now[key], total)} />{/each}
    </div>
    <p class="punch">Au total, {money(taxes, perLitre)} de taxes affichées, soit {percent(taxes, total)} de ce que vous payez. Le pétrole, lui, ne pèse que {percent(now.oil, total)}. <a href="/taxes">Et il y a les taxes qu'on ne voit pas.</a></p>
  </section>

  {#if fuel.forecast}
    <section class="section" aria-labelledby="attendre">
      <h2 class="h2" id="attendre">Plein maintenant ou j'attends&#160;?</h2>
      <p class="lead">Ce que le marché de gros annonce pour la semaine qui vient. <a href="/prevision">Méthode et bilan réel</a>.</p>
      <div class="grid-cards" style="margin-top: 20px">{#each fuel.forecast.products as f (f.id)}<TrendCard {f} compact />{/each}</div>
    </section>
  {/if}

  {#if fuel.stations}<StationsToday stations={fuel.stations} litres={perLitre ? 50 : litres} />{/if}

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .hero-grid { display: flex; flex-wrap: wrap; gap: 32px 48px; align-items: center; }
  .hero-text { flex: 1 1 520px; min-width: 0; }
  .bar-wrap { margin-top: 32px; }
  .parts { margin-top: 18px; }
</style>
