<script lang="ts">
  // Prix du baril et prix à la pompe : la courbe depuis 2005, et le rôle du dollar.
  import Toggle from '#lib/components/Toggle.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur2, longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const fuel = $derived(data.page);
  let productId = $state('diesel');
  const p = $derived(fuel.products.find((x) => x.id === productId) ?? fuel.products[0]!);
  const name = $derived(p.label.toLowerCase());
  const m = $derived(fuel.market);
  const usd = (v: number) => `${Math.round(v)} $`;
  const rate = (v: number) => `${v.toFixed(2).replace('.', ',')} $`;
  const refYear = $derived(Number(fuel.referenceLabel.match(/\d{4}/)?.[0] ?? 2008));
  const firstYear = $derived(p.quarterly[0]?.year ?? refYear);
  const quarterLabel = (y: number, q: number) => `${q}${q === 1 ? 'er' : 'e'} trimestre ${y}`;
  const years = $derived([2005, 2010, 2015, 2020, 2025].filter((y) => y >= firstYear)
    .map((y) => ({ index: p.quarterly.findIndex((q) => q.year === y), label: String(y) })).filter((t) => t.index >= 0));

  const faq = $derived([
    { q: "Quel est le cours du pétrole aujourd'hui ?", a: `Le baril de Brent, la référence européenne, cotait ${usd(m.brentLatest.value)} le ${longDate(m.brentLatest.date)}, d'après l'EIA. Un euro valait ${rate(m.usdPerEur.now)}.` },
    { q: 'Prix du baril : pourquoi il ne fait pas le prix à la pompe ?', a: `Un baril contient 159 litres de pétrole brut. Converti en euros, il revient cette semaine à ${eur2(p.now.oil)} par litre, sur ${eur2(p.litre)} payés à la pompe pour le ${name}. Le reste : raffinage, transport, distribution et taxes.` },
    { q: 'Pourquoi le dollar compte-t-il autant ?', a: `Le pétrole s'achète en dollars. En ${fuel.referenceLabel.toLowerCase()}, un euro valait ${rate(m.usdPerEur.reference)} ; aujourd'hui ${rate(m.usdPerEur.now)}. Le même baril coûte donc plus cher en euros quand l'euro baisse.` },
    { q: 'Le carburant va-t-il baisser ?', a: "Le prix à la pompe suit celui du pétrole avec quelques jours de retard. Winnza publiera une tendance de la semaine à venir, seulement une fois qu'elle aura fait ses preuves sur les années passées." },
  ]);
</script>

<Seo site={data.site} page={{ path: '/prix-du-baril', title: "Prix du baril et cours du pétrole (Brent) aujourd'hui | Winnza",
  description: `Le baril de Brent cote ${usd(m.brentLatest.value)} (cours du ${longDate(m.brentLatest.date)}), mais ne fait pas le prix à la pompe. Le pétrole ramené au litre, le rôle du dollar, et la courbe depuis ${firstYear}. Chiffres officiels.`,
  faq, modified: fuel.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.drop} size={16} />Brent, euro/dollar et prix à la pompe</p>
    <h1 class="h1" id="titre">Le prix du baril de pétrole aujourd'hui</h1>
    <p class="headline"><span class="mid">{usd(m.brentLatest.value)}</span><span class="sub">le baril de Brent, cours du {longDate(m.brentLatest.date)}</span></p>
    <p class="intro">Mais le baril ne fait pas le prix à la pompe : le pétrole, ramené au litre, coûte à peu près ce qu'il coûtait en {refYear}. L'écart avec ce que vous payez, lui, s'est creusé.</p>
    <div class="controls">
      <Toggle label="Carburant" bind:value={productId} options={fuel.products.map((x) => ({ id: x.id, label: x.label }))} />
    </div>
    <div class="tiles">
      <div class="tile"><div class="tile-label">Baril de Brent</div><div class="tile-value">{usd(m.brentUsd.reference)} → {usd(m.brentLatest.value)}</div><div class="tile-sub">{fuel.referenceLabel.toLowerCase()}, puis le {longDate(m.brentLatest.date)}</div></div>
      <div class="tile"><div class="tile-label">Un euro vaut</div><div class="tile-value">{rate(m.usdPerEur.reference)} → {rate(m.usdPerEur.now)}</div><div class="tile-sub">l'euro faible renchérit le baril</div></div>
      <div class="tile"><div class="tile-label">Le pétrole, ramené au litre</div><div class="tile-value">{eur2(p.reference.oil)} → {eur2(p.now.oil)}</div><div class="tile-sub">presque le même prix qu'en {refYear}</div></div>
    </div>
  </section>

  <section class="section" aria-labelledby="courbe">
    <h2 class="h2" id="courbe">Le {name} et le pétrole depuis {firstYear}</h2>
    <figure class="card fig">
      <LineChart labels={p.quarterly.map((q) => quarterLabel(q.year, q.quarter))} {years}
        series={[{ key: 'pump', label: `Prix à la pompe (${name})`, color: 'var(--ink)', values: p.quarterly.map((q) => q.pump) },
                 { key: 'oil', label: 'Pétrole brut, ramené au litre', color: 'var(--s1)', values: p.quarterly.map((q) => q.oil) }]}
        label="Prix du {name} à la pompe et prix du pétrole brut au litre, par trimestre depuis {firstYear}. Flèches gauche et droite pour parcourir." />
      <figcaption class="caption">En euros par litre, moyennes par trimestre. Survolez la courbe, ou utilisez les flèches du clavier.</figcaption>
    </figure>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>
