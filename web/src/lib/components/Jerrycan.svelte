<script lang="ts">
  // Le litre « en couches » : un bidon rempli des quatre parts, à proportion, du bas vers le haut.
  import { LITRE_PARTS, PART_META, type LitrePart } from '#lib/parts.ts';
  let { values, texts, label }: { values: Record<LitrePart, number>; texts: Record<LitrePart, string>; label: string } = $props();

  const TOP = 40, BOTTOM = 202, GAP = 2;
  const SHAPE = 'M22 40 h86 l20 20 v128 a14 14 0 0 1 -14 14 h-92 a14 14 0 0 1 -14 -14 v-134 a14 14 0 0 1 14 -14z';
  const layers = $derived.by(() => {
    const total = LITRE_PARTS.reduce((s, k) => s + values[k], 0);
    let y = BOTTOM;
    return LITRE_PARTS.map((k) => {
      const h = (values[k] / total) * (BOTTOM - TOP);
      y -= h;
      return { k, y, h: Math.max(0, h - GAP) };
    });
  });
</script>

<figure class="card jerrycan" aria-label={label}>
  <svg width="150" height="210" viewBox="0 0 150 210" aria-hidden="true">
    <defs><clipPath id="jerrycan-shape"><path d={SHAPE} /></clipPath></defs>
    <path d="M44 10 h40 a8 8 0 0 1 8 8 v22 h-14 v-16 h-28 v16 h-14 v-22 a8 8 0 0 1 8 -8z" fill="var(--line)" />
    <rect x="104" y="22" width="16" height="22" rx="4" fill="var(--line)" transform="rotate(35 112 33)" />
    <g clip-path="url(#jerrycan-shape)">
      <rect width="150" height="210" fill="var(--soft)" />
      {#each layers as l (l.k)}<rect x="0" y={l.y} width="150" height={l.h} fill={PART_META[l.k].color} />{/each}
    </g>
    <path d={SHAPE} fill="none" stroke="var(--ink)" stroke-opacity="0.15" stroke-width="2" />
  </svg>
  <ol>
    {#each [...LITRE_PARTS].reverse() as k (k)}
      <li>
        <span class="dot" style:background={PART_META[k].color}></span>
        <span class="txt"><strong>{texts[k]}</strong><span>{PART_META[k].short}</span></span>
      </li>
    {/each}
  </ol>
</figure>

<style>
  .jerrycan { flex: 0 1 360px; margin: 0; display: flex; align-items: center; gap: 20px; padding: 24px; border-radius: 28px; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  li { display: flex; align-items: flex-start; gap: 10px; }
  .dot { width: 14px; height: 14px; flex: 0 0 14px; margin-top: 5px; border-radius: 4px; }
  .txt { display: flex; flex-direction: column; }
  strong { font-size: 18px; font-weight: 800; }
  .txt span { font-size: 13px; color: var(--ink2); }
</style>
