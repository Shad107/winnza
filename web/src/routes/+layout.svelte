<script lang="ts">
  // polices hébergées par le site lui-même : aucune adresse IP de visiteur envoyée à Google
  import '@fontsource-variable/inter';
  import '@fontsource/archivo-black';
  import '../app.css';
  import Header from '#lib/components/Header.svelte';
  import Footer from '#lib/components/Footer.svelte';
  let { data, children } = $props();
</script>

<Header />
{@render children()}
<Footer site={data.site} audience={data.audience} />
