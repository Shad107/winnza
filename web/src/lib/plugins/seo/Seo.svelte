<script lang="ts">
  // Balises de tête d'une page, toutes rendues par le serveur (visibles des moteurs sans JavaScript).
  import { jsonLd, type PageSeo, type SiteDecl } from './index';
  let { site, page }: { site: SiteDecl; page: PageSeo } = $props();
  const canonical = $derived(site.url + page.path);
  const ld = $derived(`<script type="application/ld+json">${jsonLd(site, page)}</` + `script>`);
</script>

<svelte:head>
  <title>{page.title}</title>
  <meta name="description" content={page.description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={site.name} />
  <meta property="og:locale" content={site.locale} />
  <meta property="og:title" content={page.title} />
  <meta property="og:description" content={page.description} />
  <meta property="og:url" content={canonical} />
  <meta name="twitter:card" content="summary" />
  {@html ld}
</svelte:head>
