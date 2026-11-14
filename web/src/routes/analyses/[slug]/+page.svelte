<script lang="ts">
  // Une analyse : texte de l'IA, chiffres tirés de la base (voir server/src/pages/articles.ts).
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';

  let { data } = $props();
  const a = $derived(data.article);
</script>

<Seo site={data.site} page={{ path: `/analyses/${a.slug}`, title: `${a.title} | Winnza`, description: a.description, faq: [], modified: a.date }} />

<main class="wrap">
  <article class="section prose" style="padding-top: 32px">
    <p class="meta">{longDate(a.date)} · Rédigé par l'IA de Winnza, chiffres officiels relevés par Winnza</p>
    <h1 class="h1">{a.title}</h1>
    <!-- Markdown sans HTML, vérifié par l'intégration continue, chevrons échappés au rendu -->
    {@html data.html}
    <p class="meta"><a href="/analyses">Toutes les analyses</a></p>
  </article>
  <NextPages links={PAGES} />
</main>

<style>
  .prose { max-width: 720px; }
  .meta { font-size: 14px; color: var(--muted); }
  .prose :global(p), .prose :global(li) { font-size: 17px; line-height: 1.7; color: var(--ink2); }
  .prose :global(h2) { font-size: 24px; margin-top: 32px; }
</style>
