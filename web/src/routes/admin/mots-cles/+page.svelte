<script lang="ts">
  // Ce que les gens tapent dans Google, page par page : ce qui doit guider les titres, les questions
  // fréquentes et les pages à créer.
  import { longDate } from '#lib/format.ts';
  import { KEYWORDS_STALE_DAYS } from '@winnza/core/pages/keywords-page.js';

  let { data } = $props();
  const kw = $derived(data.keywords);
  const COMPETITION: Record<string, string> = { LOW: 'faible', MEDIUM: 'moyenne', HIGH: 'forte' };
  const n = (v: number) => v.toLocaleString('fr-FR');
  const trend = (t: number | null) => (t === null ? '' : `${t >= 0 ? '+' : '−'}${Math.round(Math.abs(t) * 100)} %`);
  let open = $state<string | null>(null);
</script>

<div class="top"><h1>Mots-clés</h1><a class="btn" href="/admin/plugins">Plugins</a></div>
{#if !kw}
  <p class="lead">Aucun relevé : le plugin « mots-clés » n'a pas encore tourné, ou les identifiants Google manquent sur le serveur.</p>
{:else}
  <p class="lead">Recherches mensuelles moyennes en France (Keyword Planner), relevé du {longDate(kw.date)}. Tendance : dernier mois connu comparé à la moyenne des 12 mois.</p>
  {#if kw.stale}<p class="err" role="alert">Relevé de plus de {KEYWORDS_STALE_DAYS} jours : le jeton Google a sans doute expiré (mode Test, 7 jours). Il faut réautoriser l'accès.</p>{/if}
  {#each kw.groups as g (g.id)}
    <section class="card group">
      <button type="button" class="head" aria-expanded={open === g.id} onclick={() => (open = open === g.id ? null : g.id)}>
        <span><strong>{g.label}</strong> <a href={g.page} onclick={(e) => e.stopPropagation()}>{g.page}</a></span>
        <span class="tot">{n(g.total)} recherches par mois, {g.ideas.length} idées</span>
      </button>
      <ol class="top5">{#each g.ideas.slice(0, 5) as i (i.text)}<li>{i.text} <span>{n(i.volume)}</span></li>{/each}</ol>
      {#if open === g.id}
        <table>
          <thead><tr><th scope="col">Mot-clé</th><th scope="col">Par mois</th><th scope="col">Tendance</th><th scope="col">Concurrence</th></tr></thead>
          <tbody>
            {#each g.ideas as i (i.text)}
              <tr class:seed={i.seed}><th scope="row">{i.text}</th><td>{n(i.volume)}</td><td>{trend(i.trend)}</td><td>{COMPETITION[i.competition] ?? ''}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  {/each}
{/if}

<style>
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .lead { color: var(--ink2); }
  .err { color: var(--up-strong); font-weight: 600; }
  .btn { min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 12px; background: var(--soft); color: var(--ink); font-weight: 600; text-decoration: none; }
  .group { padding: 16px 18px; margin-top: 14px; }
  .head { width: 100%; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; border: 0; background: none; color: var(--ink); font: 15px 'Inter Variable', system-ui, sans-serif; text-align: left; cursor: pointer; min-height: 44px; padding: 0; }
  .tot { color: var(--muted); font-size: 14px; }
  .top5 { margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: var(--ink2); }
  .top5 span { color: var(--muted); }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
  th, td { text-align: left; padding: 6px; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
  thead th { color: var(--muted); font-weight: 600; border-top: 0; }
  tbody th { font-weight: 500; }
  tr.seed th { font-weight: 800; }
</style>
