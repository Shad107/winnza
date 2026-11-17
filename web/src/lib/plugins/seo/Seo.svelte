<script lang="ts">
  // Balises de tête d'une page, toutes rendues par le serveur (visibles des moteurs sans JavaScript).
  import { jsonLd, type PageSeo, type SiteDecl } from './index';
  /** image : chemin de l'aperçu pour les réseaux sociaux (1200 × 630), null tant qu'aucun mème n'existe, et sa
   *  description ; article : une
   *  page de mème (og:type article, date de publication) plutôt qu'une page du site */
  let { site, page, image, imageAlt, video = null, article = false }: { site: SiteDecl; page: PageSeo; image: string | null; imageAlt: string; video?: string | null; article?: boolean } = $props();
  const canonical = $derived(site.url + page.path);
  const shareImage = $derived(image && site.url + image);
  const ld = $derived(`<script type="application/ld+json">${jsonLd(site, page)}</` + `script>`);
</script>

<svelte:head>
  <title>{page.title}</title>
  <meta name="description" content={page.description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content={article ? 'article' : 'website'} />
  {#if article && page.modified}<meta property="article:published_time" content={page.modified} />{/if}
  <meta property="og:site_name" content={site.name} />
  <meta property="og:locale" content={site.locale} />
  <meta property="og:title" content={page.title} />
  <meta property="og:description" content={page.description} />
  <meta property="og:url" content={canonical} />
  {#if shareImage}
    <meta property="og:image" content={shareImage} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content={imageAlt} />
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
  {#if video}
    <meta property="og:video" content={site.url + video} />
    <meta property="og:video:type" content="video/mp4" />
  {/if}
  {@html ld}
</svelte:head>
