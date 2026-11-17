<script lang="ts">
  // Un mème des semaines précédentes, en vignette : l'image de fond, la semaine, le titre.
  import type { MemeCardData } from '#lib/server/meme-card.ts';
  let { meme }: { meme: MemeCardData } = $props();
</script>

<a class="thumb" href={meme.href}>
  <img src={meme.image} alt={meme.alt} width="1536" height="1024" loading="lazy" />
  <span class="week">Semaine {meme.week}</span>
  <span class="title">{meme.title}</span>
</a>

<style>
  .thumb { display: flex; flex-direction: column; gap: 10px; text-decoration: none; color: var(--ink); }
  img { display: block; width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 12px; }
  .week { font-size: 13px; color: var(--muted); }
  .title { font-weight: 600; font-size: 16px; line-height: 1.35; }
</style>
