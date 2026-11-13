<script lang="ts">
  let { children } = $props();
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="wrap admin">
  {@render children()}
</main>

<style>
  .admin { padding-top: 40px; padding-bottom: 40px; max-width: 900px; }
  /* le formulaire partagé (OpenPluginHost) prend la charte de Winnza par ses variables */
  .admin { --oph-border: var(--line); --oph-input: var(--card); --oph-muted: var(--muted); --oph-radius: 12px; }
  .admin :global(.oph-submit) { border: 0; border-radius: 12px; padding: 0 20px; background: #2a78d6; color: #fff; font: 700 15px 'Inter Variable', system-ui, sans-serif; }
  .admin :global(.oph-btn) { border: 0; border-radius: 12px; padding: 0 14px; background: var(--soft); color: var(--ink); font: 600 14px 'Inter Variable', system-ui, sans-serif; }
  .admin :global(.oph-status) { color: var(--ink2); }
</style>
