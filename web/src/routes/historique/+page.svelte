<script lang="ts">
  // Le prix du litre depuis 2005 : année par année, et 2008 contre aujourd'hui.
  import Toggle from '#lib/components/Toggle.svelte';
  import StackedBar from '#lib/components/StackedBar.svelte';
  import ColumnsChart from '#lib/components/ColumnsChart.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { LITRE_PARTS, LITRE_SEGMENTS, PART_META, ICON } from '#lib/parts.ts';
  import { eur2, signed, longDate } from '#lib/format.ts';
  import { sum, fitText, describe } from '#lib/view.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const fuel = $derived(data.page);
  let productId = $state('diesel');
  const p = $derived(fuel.products.find((x) => x.id === productId) ?? fuel.products[0]!);
  const name = $derived(p.label.toLowerCase());
  const total = $derived(sum(p.now));
  const total08 = $derived(sum(p.reference));
  const maxTotal = $derived(Math.max(total, total08));
  const refYear = $derived(Number(fuel.referenceLabel.match(/\d{4}/)?.[0] ?? 2008));
  const lastYear = $derived(p.annual.at(-1)?.year ?? refYear);
  const firstYear = $derived(p.annual[0]?.year ?? refYear);

  const faq = $derived([
    { q: `Pourquoi le carburant est-il plus cher qu'en ${refYear} ?`,
      a: `En ${fuel.referenceLabel.toLowerCase()}, le litre de ${name} coûtait ${eur2(total08)} ; il coûte ${eur2(total)} aujourd'hui. Le pétrole n'en explique que ${eur2(p.now.oil - p.reference.oil)}. Le reste vient du raffinage et de la distribution (${signed(p.now.refine - p.reference.refine, true)}), puis des taxes (${signed(p.now.excise + p.now.vat - p.reference.excise - p.reference.vat, true)}).` },
    { q: `Quel était le prix du ${name} en ${refYear} ?`, a: `En moyenne ${eur2(total08)} le litre en ${fuel.referenceLabel.toLowerCase()}, mois du record historique du baril.` },
  ]);
</script>

<Seo site={data.site} page={{ path: '/historique', title: `Prix du carburant depuis ${firstYear} : ce qui a changé depuis 2008 | Winnza`,
  description: `Le prix d'un litre de gazole et de sans plomb année par année depuis ${firstYear}, et la comparaison avec 2008, l'année du record du baril. Pétrole, raffinage, TICPE, TVA.`,
  faq, modified: fuel.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Depuis {firstYear}, chiffres officiels</p>
    <h1 class="h1" id="titre">Le prix du litre depuis {firstYear}</h1>
    <p class="intro">Ce que contient un litre, année après année. Et ce qui a vraiment changé depuis {refYear}, l'année du record du baril.</p>
    <div class="controls">
      <Toggle label="Carburant" bind:value={productId} options={fuel.products.map((x) => ({ id: x.id, label: x.label }))} />
    </div>
  </section>

  <section class="section" aria-labelledby="annees" style="padding-top: 24px">
    <h2 class="h2" id="annees">Un litre de {name}, année par année</h2>
    <p class="lead">La TICPE a peu bougé depuis 2018. Ce qui grossit, cette année, c'est la part de la raffinerie et de la station.</p>
    <figure class="card fig">
      <ColumnsChart parts={LITRE_SEGMENTS} rows={p.annual} highlight={[refYear, lastYear]} label="Décomposition du prix d'un litre de {name} par année depuis {firstYear}, en quatre parts : pétrole, raffinerie et station, TICPE, TVA." />
      <figcaption class="caption">Moyenne de chaque année, en euros par litre, France. {lastYear} : jusqu'au {longDate(fuel.asOf)}. Survolez une colonne pour le détail.</figcaption>
    </figure>
  </section>

  <section class="section" aria-labelledby="avant">
    <h2 class="h2" id="avant">En {refYear}, le baril battait son record. Le litre coûtait {eur2(total08)}.</h2>
    <p class="lead">Le litre de {name} coûte aujourd'hui {eur2(total)}, soit {eur2(total - total08)} de plus. Le pétrole n'en explique que {eur2(p.now.oil - p.reference.oil)}.</p>
    <div class="card pad">
      <div class="compare">
        {#each [{ title: fuel.referenceLabel, values: p.reference, tot: total08 }, { title: 'Cette semaine', values: p.now, tot: total }] as row (row.title)}
          <div class="row">
            <span class="row-title">{row.title}</span>
            <div class="row-bar">
              <StackedBar parts={LITRE_SEGMENTS} values={row.values} texts={fitText(row.values, row.tot, true, row.tot / maxTotal)} scale={row.tot / maxTotal} label={describe(row.values, row.title, true)} />
              <span class="row-total">{eur2(row.tot)}</span>
            </div>
          </div>
        {/each}
      </div>
      <div class="tiles">
        {#each LITRE_PARTS as key (key)}
          <div class="tile"><div class="tile-label"><span class="tile-dot" style:background={PART_META[key].color}></span>{PART_META[key].label}</div><div class="tile-value">{signed(p.now[key] - p.reference[key], true)}</div><div class="tile-sub">depuis {fuel.referenceLabel.toLowerCase()}</div></div>
        {/each}
      </div>
    </div>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .compare { display: flex; flex-direction: column; gap: 18px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .row-title { flex: 0 0 140px; font-size: 15px; font-weight: 700; }
  .row-bar { flex: 1 1 360px; min-width: 0; display: flex; align-items: center; gap: 12px; }
  .row-total { font-size: 18px; font-weight: 800; white-space: nowrap; }
</style>
