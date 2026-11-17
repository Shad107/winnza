<script lang="ts">
  // Balises de tête d'une page, toutes rendues par le serveur (visibles des moteurs sans JavaScript).
  import { jsonLd, type PageSeo, type SiteDecl } from './index';
  /** image : chemin de l'image de partage (mème complet, 1200 × 864) */
  let { site, page, image }: { site: SiteDecl; page: PageSeo; image: string } = $props();
  const canonical = $derived(site.url + page.path);
  const shareImage = $derived(site.url + image);
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
  <meta property="og:image" content={shareImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="864" />
  <meta name="twitter:card" content="summary_large_image" />
  {@html ld}
</svelte:head>
