<script lang="ts">
  import { ICON, type IconName } from '#lib/parts.ts';
  let { name, size = 20, color = 'currentColor' }: { name: IconName; size?: number; color?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === ICON.drop}
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
  {:else if name === ICON.refinery}
    <path d="M3 21V11l5 3V11l5 3V5h4v16z" /><path d="M3 21h18" /><path d="M17 9h4v12" />
  {:else if name === ICON.state}
    <path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8" /><path d="M3 21h18" />
  {:else if name === ICON.percent}
    <path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" />
  {:else if name === ICON.chart}
    <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
  {:else if name === ICON.spark}
    <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  {/if}
</svg>
