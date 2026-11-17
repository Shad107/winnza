<script lang="ts">
  import Logo from './Logo.svelte';
  import { page } from '$app/state';
  // Trois entrées : la semaine en cours (l'accueil), les archives (bas de l'accueil), le casting.
  const NAV = [{ href: '/', label: 'Cette semaine' }, { href: '/#archives', label: 'Archives' }, { href: '/personnages', label: 'Les personnages' }] as const;
  const current = (href: string) => page.url.pathname === href;
</script>

<header>
  <div class="wrap bar">
    <a href="/" aria-label="Winnza, accueil" class="home"><Logo /></a>
    <nav aria-label="Rubriques">
      {#each NAV as n (n.href)}<a href={n.href} class:on={current(n.href)} aria-current={current(n.href) ? 'page' : undefined}>{n.label}</a>{/each}
    </nav>
  </div>
</header>

<style>
  header { border-bottom: 1px solid var(--line); }
  .bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; padding-top: 14px; padding-bottom: 14px; }
  .home { text-decoration: none; }
  nav { display: flex; gap: 4px 20px; flex-wrap: wrap; font-size: 15px; font-weight: 600; }
  nav a { color: var(--muted); text-decoration: none; padding: 10px 0; }
  nav a.on { color: var(--ink); }
</style>
