<script lang="ts">
  import Logo from './Logo.svelte';
  import { longDate } from '#lib/format.ts';
  import { page } from '$app/state';
  // Les rubriques pas encore en ligne restent visibles (« bientôt ») mais ne sont pas des liens morts.
  let { asOf, items }: { asOf: string; items: readonly { label: string; href?: string }[] } = $props();
  const isCurrent = (href: string) => page.url.pathname === href;
</script>

<header>
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="Winnza, accueil"><Logo />Winnza</a>
    <nav aria-label="Rubriques">
      {#each items as it (it.label)}
        {#if it.href}
          <a href={it.href} aria-current={isCurrent(it.href) ? 'page' : undefined} class:current={isCurrent(it.href)}>{it.label}</a>
        {:else}
          <span class="soon" aria-disabled="true">{it.label}<small>bientôt</small></span>
        {/if}
      {/each}
    </nav>
    <span class="fresh"><span class="dot" aria-hidden="true"></span>Données du {longDate(asOf)}</span>
  </div>
</header>

<style>
  header { background: var(--card); border-bottom: 1px solid var(--line); }
  .bar { padding-top: 12px; padding-bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; }
  .brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 25px; letter-spacing: -0.8px; color: var(--ink); text-decoration: none; }
  nav { display: flex; flex-wrap: wrap; gap: 4px 24px; flex: 1 1 auto; font-size: 15px; font-weight: 600; }
  nav a { color: var(--ink2); text-decoration: none; padding: 10px 0; border-bottom: 2px solid transparent; }
  nav a.current { color: var(--ink); border-bottom-color: #2a78d6; }
  .soon { color: var(--muted); padding: 10px 0; display: inline-flex; align-items: center; gap: 6px; }
  .soon small { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: var(--soft); color: var(--ink2); border-radius: 999px; padding: 2px 7px; }
  .fresh { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  /* téléphone : une seule ligne de rubriques, qui défile, au lieu de quatre lignes empilées */
  @media (max-width: 760px) {
    nav { flex: 1 1 100%; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 0 -20px; padding: 0 20px; }
    nav::-webkit-scrollbar { display: none; }
    nav a, .soon { white-space: nowrap; }
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--s3); }
</style>
