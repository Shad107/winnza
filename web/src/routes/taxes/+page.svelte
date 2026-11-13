<script lang="ts">
  // Les taxes sur le carburant : TICPE, TVA, et les charges imposées qu'on ne voit pas sur le ticket.
  import Toggle from '#lib/components/Toggle.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur2, percent, longDate, NBSP_PERCENT } from '#lib/format.ts';
  import { sum, vatRateOf } from '#lib/view.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const fuel = $derived(data.page);
  let productId = $state('diesel');
  const p = $derived(fuel.products.find((x) => x.id === productId) ?? fuel.products[0]!);
  const name = $derived(p.label.toLowerCase());
  const total = $derived(sum(p.now));
  const taxes = $derived(p.now.excise + p.now.vat);
  const vatRate = $derived(vatRateOf(p.litre, p.now.vat));
  const known = $derived(fuel.hiddenCharges.filter((c) => c.eurPerLitre !== null));
  const hidden = $derived(known.reduce((s, c) => s + (c.eurPerLitre ?? 0), 0));
  const imposed = $derived(taxes + hidden);
  const pct = (x: number) => `${Math.round(x * 100)}${NBSP_PERCENT}`;

  const faq = $derived([
    { q: 'Combien de taxes sur un litre de carburant ?', a: `Cette semaine, ${eur2(taxes)} par litre de ${name} : ${eur2(p.now.excise)} de TICPE et ${eur2(p.now.vat)} de TVA, soit ${percent(taxes, total)} du prix. En comptant les charges imposées mais cachées, comme les certificats d'économies d'énergie, on atteint ${percent(imposed, total)}.` },
    { q: "C'est quoi la TICPE ?", a: `La taxe intérieure de consommation sur les produits énergétiques, aujourd'hui appelée accise sur les énergies. Un montant fixe par litre, voté chaque année : ${eur2(p.now.excise)} pour le ${name}. Elle ne baisse pas quand le pétrole baisse.` },
    { q: 'Pourquoi paie-t-on de la TVA sur une taxe ?', a: `La TVA de ${pct(vatRate)} s'applique au prix hors taxes, mais aussi à la TICPE. Sur un litre de ${name}, cela fait environ ${eur2(p.now.excise * vatRate)} de TVA payés sur la seule TICPE.` },
  ]);
</script>

<Seo site={data.site} page={{ path: '/taxes', title: 'Taxes sur le carburant : TICPE, TVA et taxes cachées | Winnza',
  description: `Combien de taxes dans un litre de ${fuel.products[0]!.label.toLowerCase()} ? TICPE, TVA, et les charges imposées qu'on ne voit pas (certificats d'économies d'énergie, stocks stratégiques). Chiffres officiels et sources.`,
  faq, modified: fuel.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.state} size={16} />Taxes affichées et charges cachées</p>
    <h1 class="h1" id="titre">Les taxes sur le carburant</h1>
    <p class="intro">Sur un litre, l'État prend la TICPE et la TVA. Mais d'autres charges imposées aux vendeurs finissent aussi dans le prix, sans jamais apparaître sur le ticket.</p>
    <div class="controls">
      <Toggle label="Carburant" bind:value={productId} options={fuel.products.map((x) => ({ id: x.id, label: x.label }))} />
    </div>
  </section>

  <section class="section" aria-labelledby="impose" style="padding-top: 24px">
    <div class="card pad">
      <div class="headline" style="margin-top: 0">
        <span class="mid">{eur2(imposed)}</span>
        <span class="sub">sur {eur2(total)} le litre de {name} sont imposés par l'État, soit {percent(imposed, total)}, en comptant les charges cachées</span>
      </div>
      <div class="thin" role="img" aria-label="{percent(imposed, total)} du prix est imposé par l'État">
        <span style:flex-grow={imposed} style:background="var(--s3)"></span><span style:flex-grow={total - imposed} style:background="var(--line)"></span>
      </div>
      <div class="thin-legend"><span>Imposé par l'État</span><span>Pétrole, raffinage, transport, stations</span></div>
      <h2 class="sr-only" id="impose">Le détail</h2>
      <ul class="charges">
        <li><span class="tag shown">Affichée</span><span class="what"><strong>TICPE (accise sur les énergies)</strong><span>Montant fixe par litre, voté chaque année.</span></span><span class="amount">{eur2(p.now.excise)}</span></li>
        <li><span class="tag shown">Affichée</span><span class="what"><strong>TVA</strong><span>{pct(vatRate)} sur tout le reste, y compris sur la TICPE et sur les charges cachées ci-dessous.</span></span><span class="amount">{eur2(p.now.vat)}</span></li>
        {#each fuel.hiddenCharges as c (c.id)}
          <li>
            <span class="tag hidden">Cachée</span>
            <span class="what"><strong>{c.label}</strong><span>{c.description} <a href={c.source.url}>{c.source.name}</a>{c.asOf ? `, relevé du ${longDate(c.asOf)}` : ''}.</span></span>
            <span class="amount">{c.eurPerLitre === null ? 'non publié' : eur2(c.eurPerLitre)}</span>
          </li>
        {/each}
      </ul>
      <p class="caption">Montants estimés : les vendeurs ne publient pas le coût exact qu'ils répercutent. Ils sont déjà compris dans « la raffinerie et la station », pas ajoutés en plus.</p>
    </div>
  </section>

  <section class="section" aria-labelledby="comprendre">
    <div class="split">
      <h2 class="h2" id="comprendre">Comprendre en une minute</h2>
      <span class="ai-note"><Icon name={ICON.spark} size={14} />Explications tenues à jour par l'IA de Winnza</span>
    </div>
    <div class="grid-cards explain">
      <article class="card x"><div class="badge wide" style:background="var(--s3)" style:color="var(--on-s3)">TICPE</div><h3>Une taxe fixe par litre</h3><p>{eur2(p.now.excise)} sur chaque litre de {name}, quel que soit le prix du pétrole. Quand le baril baisse, elle ne baisse pas.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s4)" style:color="var(--on-s4)">{pct(vatRate)}</div><h3>Une taxe sur une taxe</h3><p>La TVA est calculée sur le prix hors taxes plus la TICPE : environ {eur2(p.now.excise * vatRate)} de TVA par litre payés sur la seule TICPE.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s2)" style:color="var(--on-s2)">CEE</div><h3>Des économies d'énergie payées à la pompe</h3><p>Les vendeurs de carburant doivent financer l'isolation et les chaudières des ménages. Le coût est répercuté dans chaque litre, sans figurer sur le ticket.</p></article>
    </div>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .thin { display: flex; gap: 2px; height: 12px; margin-top: 18px; }
  .thin span { border-radius: 999px; }
  .thin-legend { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); margin-top: 6px; gap: 12px; }
  .charges { list-style: none; margin: 24px 0 0; padding: 0; }
  .charges li { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 16px; padding: 16px 0; border-top: 1px solid var(--line); }
  .tag { flex: 0 0 auto; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-top: 2px; }
  .tag.shown { background: var(--soft); color: var(--ink2); }
  .tag.hidden { background: var(--ink); color: var(--card); }
  .what { flex: 1 1 380px; min-width: 0; }
  .what strong { display: block; font-size: 16px; }
  .what span { display: block; font-size: 14px; line-height: 1.55; color: var(--ink2); margin-top: 2px; }
  .amount { font-size: 20px; font-weight: 800; white-space: nowrap; }
  .split { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
</style>
