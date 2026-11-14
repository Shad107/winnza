<script lang="ts">
  // Les propositions de l'IA : le titre et la description actuels, la proposition, les recherches visées,
  // et ce que les contrôles y ont trouvé. Rien n'est publié sans un clic ici.
  import { longDate } from '#lib/format.ts';
  let { data, form } = $props();
  const ed = $derived(data.editor);
  const usd = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
</script>

<div class="top"><h1>Rédaction par IA</h1><span><a class="btn" href="/admin/mots-cles">Mots-clés</a> <a class="btn" href="/admin/plugins">Plugins</a></span></div>
{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
{#if !ed.date}
  <p class="lead">Aucune proposition : l'IA n'a pas encore tourné (clé absente, ou pas encore de mots-clés relevés).</p>
{:else}
  <p class="lead">Propositions du {longDate(ed.run?.date ?? ed.date)}{#if ed.run}, modèle {ed.run.model}, {usd(ed.run.costUsd)}{/if}. Dépensé ce mois-ci : {usd(ed.spentThisMonth)}. Rien n'est publié sans validation.</p>
  {#each ed.proposals as p (p.path)}
    {@const live = ed.overrides[p.path]}
    <section class="card prop">
      <div class="head"><strong>{p.label}</strong> <a href={p.path}>{p.path}</a>{#if live}<span class="tag on">Validé le {longDate(live.approvedOn)}</span>{/if}</div>
      <div class="cols">
        <div><div class="k">Aujourd'hui</div><div class="t">{p.current.title}</div><div class="d">{p.current.description}</div></div>
        <div><div class="k">Proposé</div><div class="t">{p.proposed.title} <span class="brand">| {data.site.name}</span></div><div class="d">{p.proposed.description}</div></div>
      </div>
      {#if p.keywords.length}<p class="kw">Recherches visées : {p.keywords.join(', ')}</p>{/if}
      {#if p.reason}<p class="kw">Pourquoi : {p.reason}</p>{/if}
      {#if p.problems.length}<p class="err">Refusée par les contrôles : {p.problems.join(' ; ')}</p>{/if}
      <div class="actions">
        {#if !p.problems.length && !(live && live.title === p.proposed.title && live.description === p.proposed.description)}
          <form method="POST" action="?/approve"><input type="hidden" name="path" value={p.path} /><button type="submit">Valider et publier</button></form>
        {/if}
        {#if live}<form method="POST" action="?/revert"><input type="hidden" name="path" value={p.path} /><button type="submit" class="ghost">Revenir au titre d'origine</button></form>{/if}
      </div>
    </section>
  {/each}
{/if}

<style>
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .lead { color: var(--ink2); }
  .err { color: var(--up-strong); font-weight: 600; }
  .btn { min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 12px; background: var(--soft); color: var(--ink); font-weight: 600; text-decoration: none; }
  .prop { padding: 16px 18px; margin-top: 14px; }
  .head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
  .tag { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: var(--soft); }
  .tag.on { background: var(--s3); color: var(--on-s3); }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 10px; }
  .k { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
  .t { font-weight: 700; margin-top: 4px; }
  .brand { color: var(--muted); font-weight: 400; }
  .d { font-size: 14px; color: var(--ink2); margin-top: 4px; line-height: 1.5; }
  .kw { font-size: 13px; color: var(--muted); margin: 8px 0 0; }
  .actions { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
  button { min-height: 44px; border: 0; border-radius: 12px; padding: 0 16px; font: 700 14px 'Inter Variable', system-ui, sans-serif; background: #2a78d6; color: #fff; cursor: pointer; }
  button.ghost { background: var(--soft); color: var(--ink); }
</style>
