<script lang="ts">
  // Accueil : la semaine, le mème de la semaine, puis les précédents.
  import MemeCard from '#lib/components/MemeCard.svelte';
  import MemeThumb from '#lib/components/MemeThumb.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { longDate } from '#lib/format.ts';
  let { data } = $props();
</script>

<Seo site={data.site} page={{ path: '/', title: `${data.site.name} : l'actualité de la semaine en un mème satirique`, description: data.site.description, modified: data.latest?.date }} image={data.latest ? '/partage/dernier.png' : null} imageAlt={data.latest ? `${data.latest.alt} Légendes : ${data.latest.top} / ${data.latest.bottom}.` : data.site.name} />

<main class="wrap">
  <section class="hero">
    {#if data.latest}<span class="badge">Semaine {data.latest.week} · {longDate(data.latest.date)}</span>{/if}
    <h1>L'actualité de la semaine, en un mème.</h1>
    <p class="lead">Un seul mème par semaine, sur ce dont tout le monde parle. Dessiné et écrit par une IA, avec ses personnages qui reviennent d'une semaine à l'autre. L'information qui l'a inspiré, elle, est vraie et citée.</p>
  </section>

  {#if data.latest}
    <MemeCard meme={data.latest} siteUrl={data.site.url} />
  {:else}
    <p class="lead">Le premier mème arrive très bientôt : l'IA lit l'actualité.</p>
  {/if}

  {#if data.previous.length}
    <section id="archives" class="archives">
      <h2>Les semaines précédentes</h2>
      <div class="grid">{#each data.previous as m (m.slug)}<MemeThumb meme={m} />{/each}</div>
    </section>
  {/if}
</main>

<style>
  main { padding-top: 40px; display: flex; flex-direction: column; gap: 28px; }
  .hero { display: flex; flex-direction: column; gap: 10px; }
  h1 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(34px, 6.5vw, 48px); line-height: 1.05; letter-spacing: -1px; }
  .archives { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
  h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 26px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
</style>
