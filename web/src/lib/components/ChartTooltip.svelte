<script lang="ts">
  // Infobulle des graphiques : la valeur d'abord, le nom ensuite ; une clé de couleur (trait ou carré)
  // à côté, jamais le texte en couleur.
  let { title, rows, footer = '', side }: {
    title: string;
    rows: { key: string; color: string; value: string; label: string; line?: boolean }[];
    footer?: string;
    side: string;
  } = $props();
</script>

<div class="tip" role="status" style={side}>
  <div class="title">{title}</div>
  {#each rows as r (r.key)}
    <div class="row">
      <span class={r.line ? 'line' : 'square'} style:background={r.color}></span>
      <strong>{r.value}</strong><span class="label">{r.label}</span>
    </div>
  {/each}
  {#if footer}<div class="footer">{footer}</div>{/if}
</div>

<style>
  .tip { position: absolute; top: 4px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; box-shadow: var(--shadow); pointer-events: none; min-width: 200px; }
  .title { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .row { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
  .line { width: 12px; height: 2px; border-radius: 2px; }
  .square { width: 12px; height: 12px; border-radius: 3px; }
  strong { font-size: 15px; min-width: 62px; }
  .label { font-size: 13px; color: var(--muted); }
  .footer { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 6px; font-size: 14px; font-weight: 700; }
</style>
