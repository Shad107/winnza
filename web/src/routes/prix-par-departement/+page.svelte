<script lang="ts">
  // Prix du carburant par département : la carte, les moins chers et les plus chers, et le tableau complet.
  import Toggle from '#lib/components/Toggle.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import FranceMap from '#lib/components/FranceMap.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur2, eur0, longDate } from '#lib/format.ts';
  import { CHANGE_DAYS } from '@winnza/core/pages/departments-page.js';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const dp = $derived(data.departments);
  let fuelId = $state('gazole');
  const fuel = $derived(dp.fuels.find((f) => f.id === fuelId) ?? dp.fuels[0]!);
  const name = $derived(fuel.label.toLowerCase());
  const rows = $derived(dp.departments.flatMap((d) => { const p = d.prices[fuel.id]; return p ? [{ ...d, ...p }] : []; }).sort((a, b) => a.avg - b.avg));
  const cheapest = $derived(rows.slice(0, 5));
  const dearest = $derived(rows.slice(-5).reverse());
  const hasChange = $derived(rows.some((r) => r.change !== null));
  const gap = $derived(rows.length ? rows.at(-1)!.avg - rows[0]!.avg : 0);
  const cents = (v: number) => { const c = Math.round(v * 100); return `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)} ct`; };

  const faq = $derived(rows.length ? [
    { q: 'Dans quel département le carburant est-il le moins cher ?', a: `Le ${longDate(fuel.date)}, pour le ${name}, c'est ${rows[0]!.label} : ${eur2(rows[0]!.avg)} le litre en moyenne, contre ${eur2(fuel.france)} pour la France entière.` },
    { q: 'Et le plus cher ?', a: `${rows.at(-1)!.label}, à ${eur2(rows.at(-1)!.avg)} le litre. L'écart entre le moins cher et le plus cher des départements atteint ${eur2(gap)} par litre, soit ${eur0(gap * 50)} sur un plein de 50 litres.` },
    { q: "Pourquoi le prix change-t-il d'un département à l'autre ?", a: "Les taxes sont les mêmes partout en métropole. L'écart vient de la concurrence locale (les grandes surfaces sont souvent moins chères), du coût du transport depuis les dépôts, et des stations d'autoroute, plus chères, qui pèsent dans certains départements." },
  ] : []);
</script>

<Seo site={data.site} page={{ path: '/prix-par-departement', title: `Prix du carburant par département : la carte du jour | Winnza`,
  description: `Le prix moyen du gazole, du SP95, de l'E10, de l'E85 et du GPL dans chaque département, d'après le flux officiel des stations. Les moins chers, les plus chers, et la carte de France.`,
  faq, modified: fuel.date }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels des stations, chaque jour</p>
    <h1 class="h1" id="titre">Le prix du carburant dans votre département</h1>
    <p class="intro">Le prix moyen du jour dans chaque département, calculé sur les prix affichés par les stations et mis à jour dans la semaine.</p>
    <div class="controls"><Toggle label="Carburant" bind:value={fuelId} options={dp.fuels.map((f) => ({ id: f.id, label: f.label }))} /></div>
  </section>

  <section class="section" aria-label="Carte" style="padding-top: 24px">
    <div class="card pad">
      <FranceMap departments={dp.departments} viewBox={dp.viewBox} fuelId={fuel.id} fuelLabel={fuel.label} france={fuel.france} />
    </div>
    <p class="caption">
      {fuel.label}, le {longDate(fuel.date)}. Moyenne nationale : {eur2(fuel.france)} le litre.
      {#if !hasChange}La variation sur {CHANGE_DAYS} jours de chaque département apparaîtra ici dès qu'une semaine de relevés quotidiens sera disponible.{/if}
      Sources : flux officiel des prix des carburants (ministère de l'Économie) ; contours : {dp.mapSource.publisher}, {dp.mapSource.licence}.
    </p>
  </section>

  {#if rows.length}
    <section class="section" aria-labelledby="extremes">
      <h2 class="h2" id="extremes">Les moins chers, les plus chers</h2>
      <p class="lead">Jusqu'à {eur2(gap)} d'écart par litre, soit {eur0(gap * 50)} sur un plein de 50 litres.</p>
      <div class="grid-cards two">
        {#each [{ title: 'Les 5 moins chers', list: cheapest }, { title: 'Les 5 plus chers', list: dearest }] as block (block.title)}
          <div class="card pad">
            <h3>{block.title}</h3>
            <ol>
              {#each block.list as r (r.code)}<li><span>{r.label} <span class="code">({r.code})</span></span><strong>{eur2(r.avg)}</strong></li>{/each}
            </ol>
          </div>
        {/each}
      </div>
    </section>

    <section class="section" aria-labelledby="tous">
      <h2 class="h2" id="tous">Tous les départements</h2>
      <details class="card pad all">
        <summary>Voir les {rows.length} départements, du moins cher au plus cher</summary>
        <table>
          <thead><tr><th scope="col">Département</th><th scope="col">Prix moyen</th><th scope="col">Stations</th>{#if hasChange}<th scope="col">Sur {CHANGE_DAYS} jours</th>{/if}</tr></thead>
          <tbody>
            {#each rows as r (r.code)}
              <tr><th scope="row">{r.label} ({r.code})</th><td>{eur2(r.avg)}</td><td>{r.stations}</td>{#if hasChange}<td>{r.change === null ? '' : cents(r.change)}</td>{/if}</tr>
            {/each}
          </tbody>
        </table>
      </details>
    </section>
  {/if}

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .two { margin-top: 20px; }
  h3 { margin: 0 0 10px; font-size: 18px; }
  ol { margin: 0; padding: 0; list-style: none; counter-reset: n; }
  li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 15px; }
  li:first-child { border-top: 0; }
  .code { color: var(--muted); }
  .all summary { cursor: pointer; font-weight: 700; min-height: 44px; display: flex; align-items: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
  th, td { text-align: left; padding: 8px 6px; border-top: 1px solid var(--line); }
  td { font-variant-numeric: tabular-nums; }
  thead th { color: var(--muted); font-weight: 600; border-top: 0; }
  tbody th { font-weight: 500; }
</style>
