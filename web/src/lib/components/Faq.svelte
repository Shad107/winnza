<script lang="ts">
  // Questions-réponses d'une page. Les mêmes questions partent aussi en données structurées (FAQPage)
  // par le plugin SEO : elles doivent rester identiques au texte affiché.
  let { items, title = 'Vos questions' }: { items: { q: string; a: string }[]; title?: string } = $props();
</script>

<section class="section" aria-labelledby="faq-titre">
  <h2 class="h2" id="faq-titre">{title}</h2>
  <div class="faq">
    {#each items as f (f.q)}
      <details class="card"><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>
    {/each}
  </div>
</section>

<style>
  .faq { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
  details { border-radius: 18px; padding: 0 22px; }
  summary { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 64px; font-size: 18px; font-weight: 700; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary span { font-size: 24px; color: var(--muted); }
  p { margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: var(--ink2); }
</style>
