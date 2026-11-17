<script lang="ts">
  // Partager un mème : le partage du téléphone quand il existe, un lien par réseau, copier le lien, et
  // télécharger l'image (pour Instagram, TikTok et les autres). Même rangée partout.
  import { NETWORKS } from '#lib/share.ts';
  let { url, text, png, file }: { url: string; text: string; png: string; file: string } = $props();
  let copied = $state(false);
  let native = $state(false);
  $effect(() => { native = typeof navigator.share === 'function'; });

  async function shareNative() { try { await navigator.share({ title: text, url }); } catch { /* partage annulé */ } }
  async function copy() {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }
</script>

<div class="share">
  <div class="main">
    {#if native}<button class="btn primary" type="button" onclick={shareNative}>Partager</button>{/if}
    <button class="btn" class:primary={!native} type="button" onclick={copy}>{copied ? 'Lien copié' : 'Copier le lien'}</button>
    <a class="btn" href={png} download={file}>Télécharger l'image</a>
  </div>
  <ul class="networks" aria-label="Partager sur un réseau social">
    {#each Object.values(NETWORKS) as n (n.label)}
      <li><a class="net" href={n.href(url, text)} target="_blank" rel="noopener noreferrer">{n.label}</a></li>
    {/each}
  </ul>
</div>

<style>
  .share { display: flex; flex-direction: column; gap: 12px; }
  .main { display: flex; gap: 10px; flex-wrap: wrap; }
  .networks { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .net { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 999px; background: var(--raised); color: var(--ink2); font-size: 14px; font-weight: 600; text-decoration: none; }
  .net:hover { color: var(--ink); }
</style>
