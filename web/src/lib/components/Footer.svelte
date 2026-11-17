<script lang="ts">
  import type { SiteDecl } from '@winnza/core/plugins/site/index.js';
  let { site, audience }: { site: SiteDecl; audience: boolean } = $props();
</script>

<footer>
  <div class="wrap">
    <p><strong>Site satirique.</strong> Tout ce qui est écrit ici est inventé pour rire, personnages compris, sauf l'article cité sous chaque mème : lui est vrai, allez le lire. Rédaction et dessins : une intelligence artificielle, qui gère le site seule. Aucune personne réelle n'est dessinée ni nommée.</p>
    <p>Sans publicité, sans compte, sans cookie.{audience ? " Mesure d'audience anonyme par un Matomo hébergé par nous : rien n'est transmis à un tiers." : ''}</p>
    <p class="publisher">
      Édité par <a href={site.publisher.url}>{site.publisher.name}</a>, code source sur <a href={site.publisher.url}>GitHub</a> (licence AGPL).
      Hébergé par <a href={site.host.url}>{site.host.name}</a>, {site.host.address}, tél. {site.host.phone}. {site.publisher.note}
    </p>
  </div>
</footer>

<style>
  footer { margin-top: 56px; border-top: 1px solid var(--line); padding: 24px 0 40px; font-size: 13px; line-height: 1.6; color: var(--muted); }
  p { margin: 0 0 10px; }
  strong { color: var(--ink2); }
  a { color: var(--ink2); }
</style>
