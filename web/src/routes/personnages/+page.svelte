<script lang="ts">
  // Les personnages de Winnza : inventés, aux noms en jeux de mots, ils reviennent d'une semaine à l'autre.
  import Seo from '#lib/plugins/seo/Seo.svelte';
  let { data } = $props();
</script>

<Seo site={data.site} page={{ path: '/personnages', title: `Les personnages | ${data.site.name}`, description: "Les personnages inventés des mèmes de Winnza, qui reviennent d'une semaine à l'autre." }} image={data.hasMemes ? '/partage/dernier.png' : null} imageAlt="Le dernier mème de Winnza." />

<main class="wrap">
  <h1>Les personnages</h1>
  <p class="lead">Tous inventés, tous de mauvaise foi. Ils reviennent d'une semaine à l'autre, au gré de l'actualité. Toute ressemblance avec une personne réelle serait une erreur de l'IA : signalez-la.</p>
  {#if !data.cast.length}<p class="lead">La troupe se forme : les premiers personnages arrivent avec le premier mème.</p>{/if}
  {#each data.cast as c (c.id)}
    <section class="card who" id={c.id}>
      <h2>{c.name}</h2>
      <p class="role">{c.role}</p>
      <p class="traits">{c.traits}</p>
      <p class="eps">Vu dans : {#each c.episodes as e, i (e.href)}{i ? ', ' : ''}<a href={e.href}>semaine {e.week}, {e.title}</a>{/each}.</p>
    </section>
  {/each}
</main>

<style>
  main { padding-top: 40px; display: flex; flex-direction: column; gap: 16px; }
  h1 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(34px, 6.5vw, 48px); line-height: 1.05; letter-spacing: -1px; }
  .who { padding: 20px 22px; display: flex; flex-direction: column; gap: 8px; scroll-margin-top: 16px; }
  h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 24px; }
  .role { margin: 0; font-size: 16px; font-weight: 600; }
  .traits { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink2); }
  .eps { margin: 0; font-size: 14px; color: var(--muted); }
</style>
