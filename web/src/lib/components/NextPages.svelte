<script lang="ts">
  // « Pour aller plus loin » : les autres pages du site, en cartes. La page courante n'y figure pas.
  import { page } from '$app/state';
  import type { Section } from '#lib/site-nav.ts';
  let { links }: { links: readonly (Section & { href: string })[] } = $props();
  const others = $derived(links.filter((l) => l.href !== page.url.pathname));
</script>

<section class="section" aria-labelledby="suite">
  <h2 class="h2" id="suite">Pour aller plus loin</h2>
  <div class="grid-cards next">
    {#each others as l (l.href)}
      <a class="card link" href={l.href}><span class="t">{l.title}</span><span class="d">{l.text}</span><span class="go" aria-hidden="true">→</span></a>
    {/each}
  </div>
</section>

<style>
  .next { margin-top: 24px; }
  .link { display: flex; flex-direction: column; gap: 6px; padding: 20px; border-radius: 20px; text-decoration: none; color: var(--ink); position: relative; }
  .link:hover { outline: 2px solid var(--brand); outline-offset: -2px; opacity: 1; }
  .t { font-size: 18px; font-weight: 800; }
  .d { font-size: 15px; line-height: 1.5; color: var(--ink2); padding-right: 24px; }
  .go { position: absolute; right: 18px; top: 18px; font-size: 20px; color: var(--brand); }
</style>
