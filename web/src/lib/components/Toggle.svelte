<script lang="ts" generics="T extends string">
  // Groupe de boutons à choix unique (carburant, litre ou plein). De vrais <button>, cible de 44 px.
  let { options, value = $bindable(), label }: { options: { id: T; label: string }[]; value: T; label: string } = $props();
</script>

<div class="toggle" role="group" aria-label={label}>
  {#each options as o (o.id)}
    <button type="button" aria-pressed={value === o.id} onclick={() => (value = o.id)}>{o.label}</button>
  {/each}
</div>

<style>
  .toggle { display: inline-flex; max-width: 100%; overflow-x: auto; scrollbar-width: none; gap: 4px; padding: 4px; border-radius: 14px; background: var(--card); box-shadow: var(--shadow); }
  /* trop de choix pour la largeur : la bande défile, elle ne déborde jamais de la page */
  button { flex: 0 0 auto; white-space: nowrap; border: 0; border-radius: 11px; padding: 0 16px; min-height: 44px; font: 600 15px 'Inter Variable', system-ui, sans-serif; cursor: pointer; background: transparent; color: var(--ink2); }
  button[aria-pressed='true'] { background: #2a78d6; color: #ffffff; font-weight: 700; }
</style>
