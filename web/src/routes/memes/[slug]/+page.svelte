<script lang="ts">
  // Un mème, à son adresse propre : c'est elle qu'on partage.
  import MemeCard from '#lib/components/MemeCard.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { longDate } from '#lib/format.ts';
  let { data } = $props();
  const m = $derived(data.meme);
</script>

<Seo site={data.site} page={{ path: m.href, title: `${m.title} | ${data.site.name}`, description: m.lead.length > 158 ? m.lead.slice(0, 157) + '…' : m.lead, modified: m.date }} image={m.png} />

<main class="wrap">
  <span class="badge">Semaine {m.week} · {longDate(m.date)}</span>
  <MemeCard meme={m} siteUrl={data.site.url} />
  <p><a class="btn" href="/">Le mème de cette semaine</a></p>
</main>

<style>
  main { padding-top: 40px; display: flex; flex-direction: column; gap: 20px; }
</style>
