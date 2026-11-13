<script lang="ts">
  // Prévision d'un carburant pour la semaine qui vient (plugin prévision), avec son bilan réel.
  import { TREND, type ProductForecast } from '@winnza/core/pages/fuel-page.js';
  import { NBSP_PERCENT } from '#lib/format.ts';
  let { f, compact = false }: { f: ProductForecast; compact?: boolean } = $props();
  const WORD = { [TREND.up]: 'Hausse probable', [TREND.down]: 'Baisse probable', [TREND.flat]: 'Pas de tendance nette' };
  const ARROW = { [TREND.up]: 'M12 19V5M5 12l7-7 7 7', [TREND.down]: 'M12 5v14M5 12l7 7 7-7', [TREND.flat]: 'M5 12h14M13 6l6 6-6 6' };
  const cents = $derived(Math.abs(Math.round(f.signal * 100)));
  const rate = (hits: number, n: number) => (n ? `${Math.round((hits / n) * 100)}${NBSP_PERCENT}` : 'pas encore de recul');
  const since = $derived(f.track.since.slice(0, 4));
</script>

<div class="card trend {f.trend}">
  <div class="head">
    <span class="arrow" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d={ARROW[f.trend]} /></svg></span>
    <span><span class="fuel">{f.label}</span><span class="word">{WORD[f.trend]}</span></span>
  </div>
  <p class="why">
    {#if f.trend === TREND.flat}Sur le marché de gros, le {f.label.toLowerCase()} a peu bougé en une semaine : pas de signal assez net pour annoncer un sens.
    {:else}Sur le marché de gros, le {f.label.toLowerCase()} a {f.trend === TREND.up ? 'pris' : 'perdu'} {cents} centime{cents > 1 ? 's' : ''} par litre en une semaine. La pompe suit en général avec quelques jours de retard.{/if}
  </p>
  {#if !compact}
    <p class="track">Bilan depuis {since} : quand le signal était net, le sens était juste <strong>{f.track.strongHits} fois sur {f.track.strongWeeks}</strong> ({rate(f.track.strongHits, f.track.strongWeeks)}). Toutes semaines confondues : {rate(f.track.allHits, f.track.allWeeks)}.</p>
  {/if}
</div>

<style>
  .trend { padding: 20px; border-radius: 20px; }
  .head { display: flex; align-items: center; gap: 14px; }
  .arrow { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: var(--soft); color: var(--ink); }
  .down .arrow { background: var(--s3); color: var(--on-s3); }
  .up .arrow { background: var(--s2); color: var(--on-s2); }
  .fuel { display: block; font-size: 14px; color: var(--ink2); font-weight: 600; }
  .word { display: block; font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
  .why { margin: 12px 0 0; font-size: 15px; line-height: 1.55; color: var(--ink2); }
  .track { margin: 10px 0 0; font-size: 14px; line-height: 1.55; color: var(--ink2); border-top: 1px solid var(--line); padding-top: 10px; }
</style>
