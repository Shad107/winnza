<script lang="ts">
  let { form } = $props();
</script>

<h1>Administration</h1>
<form method="POST" class="card box">
  <label for="token">Jeton d'administration</label>
  <input id="token" name="token" type="password" autocomplete="current-password" required />
  {#if form?.wrong}<p class="err" role="alert">Jeton refusé.</p>{/if}
  <button type="submit">Entrer</button>
</form>

<style>
  h1 { font-weight: 800; letter-spacing: -1px; }
  .box { padding: 24px; display: flex; flex-direction: column; gap: 10px; max-width: 420px; }
  label { font-weight: 600; }
  input { min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); color: inherit; font: inherit; }
  button { min-height: 44px; border: 0; border-radius: 12px; background: #2a78d6; color: #fff; font: 700 15px 'Inter Variable', system-ui, sans-serif; cursor: pointer; }
  .err { margin: 0; color: #b42318; }
</style>
