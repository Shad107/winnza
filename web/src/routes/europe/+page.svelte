<script lang="ts">
  // Le même plein chez nos voisins.
  import Toggle from '#lib/components/Toggle.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur2, money } from '#lib/format.ts';
  import { FLAG } from '#lib/flags.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const fuel = $derived(data.page);
  const UNIT = { litre: 'litre', fill: 'fill' } as const;
  type UnitId = (typeof UNIT)[keyof typeof UNIT];
  let productId = $state('diesel');
  let unit = $state<UnitId>(UNIT.fill);
  let litres = $state(50);
  const p = $derived(fuel.products.find((x) => x.id === productId) ?? fuel.products[0]!);
  const name = $derived(p.label.toLowerCase());
  const perLitre = $derived(unit === UNIT.litre);
  const k = $derived(perLitre ? 1 : litres);
  const cheapest = $derived([...p.neighbours].sort((a, b) => a.litre - b.litre)[0]);

  const faq = $derived(cheapest ? [
    { q: 'Où le carburant est-il le moins cher autour de la France ?', a: `Cette semaine, pour le ${name}, c'est ${cheapest.label} : ${eur2(cheapest.litre)} le litre contre ${eur2(p.litre)} en France, soit ${money((p.litre - cheapest.litre) * 50, false)} d'écart sur un plein de 50 litres.` },
    { q: "Pourquoi l'essence est-elle moins chère au Luxembourg ?", a: "Principalement parce que les taxes y sont plus basses : l'accise et la TVA sur les carburants sont parmi les plus faibles de l'Union européenne. Le pétrole, lui, coûte le même prix partout." },
  ] : []);
</script>

<Seo site={data.site} page={{ path: '/europe', title: 'Prix du carburant en Europe : Espagne, Luxembourg, Belgique | Winnza',
  description: `Le prix du gazole et du sans plomb chez nos voisins cette semaine, et l'écart sur votre plein : Espagne, Luxembourg, Belgique, Allemagne, Italie, Pays-Bas. Chiffres de la Commission européenne.`,
  faq, modified: fuel.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Bulletin pétrolier de la Commission européenne</p>
    <h1 class="h1" id="titre">Moins cher chez nos voisins&#160;?</h1>
    <p class="intro">Le même plein, au prix moyen de chaque pays cette semaine. L'écart vient presque entièrement des taxes : le pétrole coûte le même prix partout.</p>
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
  </section>

  <section class="section" aria-label="Pays voisins" style="padding-top: 24px">
    <div class="grid-cards neighbours">
      <div class="card country home">
        <div class="c-head"><span class="flag" style:background={FLAG.FR} aria-hidden="true"></span>France</div>
        <div class="c-value">{money(p.litre * k, perLitre)}</div>
        <div class="c-sub">{perLitre ? `le litre de ${name}` : `${eur2(p.litre)} le litre`}</div>
      </div>
      {#each p.neighbours as n (n.code)}
        {@const diff = (n.litre - p.litre) * k}
        <div class="card country" class:cheaper={diff < 0}>
          <div class="c-head"><span class="flag" style:background={FLAG[n.code] ?? 'var(--soft)'} aria-hidden="true"></span>{n.label}</div>
          <div class="c-value">{money(n.litre * k, perLitre)}</div>
          <div class="c-sub">{perLitre ? `le litre de ${name}` : `${eur2(n.litre)} le litre`}</div>
          <div class="c-diff">{diff < 0 ? `${money(-diff, perLitre)} de moins` : `${money(diff, perLitre)} de plus`} qu'en France</div>
        </div>
      {/each}
    </div>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .neighbours { margin-top: 8px; }
  .country { padding: 18px 20px; border-radius: 20px; }
  .country.cheaper { outline: 2px solid var(--s3); outline-offset: -2px; }
  .country.home { background: var(--soft); box-shadow: none; }
  .c-head { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; }
  .flag { width: 26px; height: 18px; border-radius: 4px; box-shadow: 0 0 0 1px var(--line); }
  .c-value { font-size: 30px; font-weight: 800; letter-spacing: -0.8px; margin-top: 10px; }
  .c-sub { font-size: 14px; color: var(--ink2); margin-top: 2px; }
  .c-diff { display: inline-block; margin-top: 12px; font-size: 14px; font-weight: 700; padding: 6px 10px; border-radius: 999px; background: var(--soft); }
</style>
