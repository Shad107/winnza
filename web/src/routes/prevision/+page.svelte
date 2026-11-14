<script lang="ts">
  // « Le carburant va-t-il baisser ? » : la prévision de la semaine qui vient, et son bilan réel.
  import Icon from '#lib/components/Icon.svelte';
  import TrendCard from '#lib/components/TrendCard.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { NBSP_PERCENT } from '#lib/format.ts';
  import { TREND } from '@winnza/core/pages/fuel-page.js';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const fc = $derived(data.page.forecast);
  const answer = $derived(fc ? fc.products.map((f) => `${f.label} : ${f.trend === TREND.down ? 'baisse probable' : f.trend === TREND.up ? 'hausse probable' : 'pas de tendance nette'}`).join(' ; ') + '.' : '');
  const best = $derived(fc?.products[0]);
  const rate = (h: number, n: number) => (n ? `${Math.round((h / n) * 100)}${NBSP_PERCENT}` : '');

  const faq = $derived(best ? [
    { q: 'Le prix du carburant va-t-il baisser la semaine prochaine ?', a: `Pour la semaine qui vient, d'après le marché de gros : ${answer} Ce n'est pas une certitude : depuis ${best.track.since.slice(0, 4)}, quand le signal était net, le sens annoncé était juste ${rate(best.track.strongHits, best.track.strongWeeks)} du temps pour le ${best.label.toLowerCase()}.` },
    { q: 'Faut-il faire le plein maintenant ou attendre ?', a: "Si une baisse est probable et que votre réservoir n'est pas presque vide, attendre quelques jours peut faire gagner quelques euros. Si une hausse est probable, autant faire le plein tôt. Sans tendance nette, rien ne sert d'attendre." },
    { q: 'Comment Winnza fait-il sa prévision ?', a: "Les prix à la pompe suivent ceux du gazole et de l'essence sur les marchés de gros, avec environ une semaine de retard. Winnza compare leur moyenne des cinq derniers jours à celle de la semaine précédente. La méthode a été testée sur les prix réels depuis 2006 avant d'être publiée." },
  ] : []);
</script>

<Seo site={data.site} page={{ path: '/prevision', title: 'Baisse des prix du carburant : va-t-il baisser la semaine prochaine ? | Winnza',
  description: `Prix du gazole et de l'essence la semaine prochaine : hausse, baisse ou stabilité, d'après le marché de gros. ${answer} Avec le bilan réel de la méthode.`,
  faq, modified: data.page.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prévision recalculée chaque jour</p>
    <h1 class="h1" id="titre">Le carburant va-t-il baisser&#160;?</h1>
    <p class="intro">Les prix à la pompe suivent le marché de gros avec environ une semaine de retard. Voici ce que ce marché annonce pour les jours qui viennent, et à quel point la méthode s'est trompée par le passé.</p>
  </section>

  {#if fc}
    <section class="section" aria-label="Prévision de la semaine" style="padding-top: 16px">
      <div class="grid-cards">
        {#each fc.products as f (f.id)}<TrendCard {f} />{/each}
      </div>
      <p class="caption">Prévision d'un sens, pas d'un prix : chaque station fixe le sien. Ce n'est ni une certitude ni un conseil financier. Source : prix de gros quotidiens (EIA, via FRED), convertis en euros par litre au cours de la BCE.</p>
    </section>
  {:else}
    <section class="section"><p class="lead">La prévision n'est pas disponible pour le moment.</p></section>
  {/if}

  <section class="section" aria-labelledby="methode">
    <h2 class="h2" id="methode">Une méthode testée avant d'être publiée</h2>
    <div class="grid-cards explain">
      <article class="card x"><div class="badge" style:background="var(--s1)" style:color="var(--on-s1)">1</div><h3>Le marché de gros d'abord</h3><p>Les stations achètent leur carburant au prix du marché de gros. Quand ce prix bouge, la pompe suit, avec quelques jours de retard.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s2)" style:color="var(--on-s2)">2</div><h3>Le produit raffiné, pas le baril</h3><p>Depuis 2022, les marges de raffinage varient beaucoup. Le prix du gazole et de l'essence de gros annonce mieux la pompe que le baril de pétrole brut.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s3)" style:color="var(--on-s3)">3</div><h3>Le bilan affiché, toujours</h3><p>Chaque semaine, le site compare ce qu'il avait annoncé à ce qui s'est vraiment passé, et affiche le résultat. Rien n'est caché.</p></article>
    </div>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>
