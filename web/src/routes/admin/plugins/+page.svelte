<script lang="ts">
  let { data, form } = $props();
  const CATEGORY_LABEL: Record<string, string> = { data: 'Données', site: 'Site', other: 'Autre' };
</script>

<div class="top">
  <h1>Plugins</h1>
  <form method="POST" action="?/logout"><button type="submit" class="ghost">Se déconnecter</button></form>
</div>
<p class="lead">Tout ce que Winnza affiche entre en base par ces plugins. Un changement prend effet à la prochaine collecte. Voir aussi : <a href="/admin/mots-cles">les mots-clés</a>.</p>
{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}

<ul class="list">
  {#each data.plugins as p (p.id)}
    <li class="card item">
      <div class="info">
        <div class="title">{p.title.fr} <span class="cat">{CATEGORY_LABEL[p.category] ?? p.category}</span></div>
        {#if p.description}<p>{p.description.fr}</p>{/if}
        <span class={['state', { on: p.enabled }]}>{p.enabled ? 'Actif' : 'Éteint'}</span>
      </div>
      <div class="actions">
        {#if p.configurable}<a class="btn" href="/admin/plugins/{p.id}">Réglages</a>{/if}
        <form method="POST" action="?/toggle">
          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.enabled ? '0' : '1'} />
          <button type="submit" class="ghost">{p.enabled ? 'Éteindre' : 'Activer'}</button>
        </form>
      </div>
    </li>
  {/each}
</ul>

<style>
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h1 { font-weight: 800; letter-spacing: -1px; margin: 0; }
  .lead { color: var(--ink2); }
  .err { color: #b42318; }
  .list { list-style: none; padding: 0; margin: 20px 0 0; display: flex; flex-direction: column; gap: 12px; }
  .item { padding: 18px 20px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 20px; align-items: center; }
  .info { flex: 1 1 380px; min-width: 0; }
  .title { font-weight: 700; font-size: 17px; }
  .cat { font-size: 12px; font-weight: 700; color: var(--ink2); background: var(--soft); border-radius: 999px; padding: 2px 8px; margin-left: 6px; }
  .info p { margin: 6px 0; color: var(--ink2); font-size: 15px; line-height: 1.5; }
  .state { font-size: 13px; font-weight: 700; color: var(--muted); }
  .state.on { color: var(--s3); }
  .actions { display: flex; gap: 8px; align-items: center; }
  .btn, button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 16px; border-radius: 12px; font: 700 15px 'Inter Variable', system-ui, sans-serif; cursor: pointer; text-decoration: none; }
  .btn { background: #2a78d6; color: #fff; }
  .ghost { background: var(--soft); color: var(--ink); border: 0; }
</style>
