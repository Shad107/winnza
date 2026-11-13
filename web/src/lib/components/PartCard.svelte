<script lang="ts">
  import Icon from './Icon.svelte';
  import { PART_META, type LitrePart } from '#lib/parts.ts';
  let { part, value, share }: { part: LitrePart; value: string; share: string } = $props();
  const meta = $derived(PART_META[part]);
</script>

<div class="card part">
  <div class="head">
    <span class="icon" style:background={meta.color}><Icon name={meta.icon} color={meta.ink} /></span>
    <span class="label">{meta.label}</span>
  </div>
  <div class="figure"><span class="value">{value}</span><span class="share">{share}</span></div>
  <p>{meta.description}</p>
</div>

<style>
  .part { padding: 18px; border-radius: 20px; }
  .head { display: flex; align-items: center; gap: 12px; }
  .icon { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; }
  .label { font-size: 16px; font-weight: 700; }
  .figure { display: flex; align-items: baseline; gap: 8px; margin-top: 12px; }
  .value { font-size: 34px; font-weight: 800; letter-spacing: -1px; }
  .share { font-size: 15px; color: var(--muted); }
  p { margin: 6px 0 0; font-size: 15px; line-height: 1.5; color: var(--ink2); }
</style>
