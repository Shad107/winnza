<script lang="ts">
  // Écran de réglages : le composant partagé d'OpenPluginHost, aux couleurs de Winnza. Le message
  // d'erreur du plugin (ce qui ne va pas dans la saisie) est montré tel quel.
  import SettingsForm from '@isno-open/plugin-host/svelte/SettingsForm.svelte';
  import type { SettingValue } from '@isno-open/plugin-host/contract';
  let { data } = $props();
  let problem = $state('');

  async function save(values: Record<string, SettingValue>): Promise<boolean> {
    problem = '';
    const res = await fetch(`/admin/plugins/${data.id}/reglages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
    if (res.ok) return true;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    problem = body.error ?? `refusé (HTTP ${res.status})`;
    return false;
  }
</script>

<p class="back"><a href="/admin/plugins">← Plugins</a></p>
<h1>{data.plugin.title.fr}</h1>
{#if data.plugin.description}<p class="lead">{data.plugin.description.fr}</p>{/if}
<div class="card box">
  <SettingsForm fields={data.fields} values={data.values} lang="fr" onSave={save} />
  {#if problem}<p class="err" role="alert">{problem}</p>{/if}
</div>

<style>
  .back a { color: var(--ink2); text-decoration: none; }
  h1 { font-weight: 800; letter-spacing: -1px; margin: 6px 0 0; }
  .lead { color: var(--ink2); }
  .box { padding: 24px; margin-top: 16px; }
  .err { color: #b42318; margin: 12px 0 0; }
</style>
