<script lang="ts">
  // Le mème en grand : son dessin (le même que l'image partagée), le titre et le chapeau satiriques, les
  // personnages, l'épisode précédent, la vraie information citée, et les boutons. Même cadre à l'accueil et
  // sur la page du mème : seul le contenu change. Le SVG vient du serveur (lib/server/meme-svg.ts), échappé.
  import ShareBar from './ShareBar.svelte';
  import type { MemeCardData } from '#lib/server/meme-card.ts';
  let { meme, siteUrl }: { meme: MemeCardData; siteUrl: string } = $props();
</script>

<article class="card meme">
  <div class="art" role="img" aria-label="{meme.alt} Légende du haut : {meme.top}. Légende du bas : {meme.bottom}.">{@html meme.svg}</div>
  <div class="body">
    <h2 class="title"><a href={meme.href}>{meme.title}</a></h2>
    <p class="lead">{meme.lead}</p>
    {#each meme.body as para, i (i)}<p class="para">{para}</p>{/each}
    <p class="meta">
      Avec {#each meme.characters as c, i (c.href)}{i ? (i === meme.characters.length - 1 ? ' et ' : ', ') : ''}<a href={c.href}>{c.name}</a>{/each}.
      {#if meme.previous}Épisode précédent : <a href={meme.previous.href}>semaine {meme.previous.week}, {meme.previous.title}</a>.{/if}
    </p>
    <p class="meta">La vraie info derrière la blague : <a href={meme.source.url} rel="noopener">{meme.source.media}, « {meme.source.title} »</a></p>
    <ShareBar url={siteUrl + meme.href} text={meme.title} png={meme.png} file="winnza-{meme.slug}.png" />
  </div>
</article>

<style>
  .meme { overflow: hidden; }
  .art { line-height: 0; }
  .art :global(svg) { display: block; width: 100%; height: auto; }
  .body { padding: 20px 22px 22px; display: flex; flex-direction: column; gap: 14px; }
  .title { margin: 0; font-size: 22px; line-height: 1.3; }
  .title a { color: var(--ink); text-decoration: none; }
  .lead { font-size: 17px; line-height: 1.6; font-weight: 600; color: var(--ink); }
  .para { margin: 0; font-size: 16px; line-height: 1.7; color: var(--ink2); }
  .meta { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }
</style>
