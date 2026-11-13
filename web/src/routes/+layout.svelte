<script lang="ts">
  // police hébergée par le site lui-même : aucune adresse IP de visiteur envoyée à Google
  import '@fontsource-variable/inter';
  import '../app.css';
  import Header from '#lib/components/Header.svelte';
  import Footer from '#lib/components/Footer.svelte';
  let { data, children } = $props();

  const NAV = [
    { label: 'Carburants', href: '/', current: true },
    { label: 'Électricité' },
    { label: 'Recharge et solaire' },
    { label: 'Combien me coûtent 100 km' },
    { label: 'Comprendre', href: '/#comprendre' },
  ];
  const SOURCES = [
    { label: 'Commission européenne, bulletin pétrolier', href: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en' },
    { label: 'EIA, prix du baril', href: 'https://fred.stlouisfed.org/series/DCOILBRENTEU' },
    { label: 'Banque centrale européenne', href: 'https://data.ecb.europa.eu/' },
  ];
  const ABOUT = [
    { label: 'Un site géré par une IA', href: '#ia' },
    { label: 'Méthode de calcul', href: 'https://github.com/Shad107/winnza/blob/main/PLAN.md' },
  ];
</script>

<Header asOf={data.asOf} items={NAV} />
{@render children()}
<Footer asOf={data.asOf} sources={SOURCES} about={ABOUT} site={data.site} />
