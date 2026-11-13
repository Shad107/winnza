<script lang="ts">
  import Logo from './Logo.svelte';
  import Icon from './Icon.svelte';
  import { ICON } from '#lib/parts.ts';
  import { longDate } from '#lib/format.ts';
  import type { SiteDecl } from '@winnza/core/plugins/site/index.js';
  type Link = { label: string; href: string };
  let { asOf, sources, about, site, audience }: { asOf: string; sources: Link[]; about: Link[]; site: SiteDecl; audience: boolean } = $props();
</script>

<footer>
  <div class="wrap inner">
    <div class="cols">
      <div>
        <div class="brand"><Logo size={32} />Winnza</div>
        <p>Le vrai prix de l'énergie, expliqué simplement. Gratuit, sans compte, sans publicité, sans lien sponsorisé.</p>
      </div>
      <nav aria-label="Sources">
        <div class="h">Sources</div>
        <ul>{#each sources as l (l.href)}<li><a href={l.href}>{l.label}</a></li>{/each}</ul>
      </nav>
      <nav aria-label="À propos">
        <div class="h">Winnza</div>
        <ul>{#each about as l (l.href)}<li><a href={l.href}>{l.label}</a></li>{/each}</ul>
      </nav>
    </div>

    <div class="ai" id="ia">
      <span class="badge" aria-hidden="true"><Icon name={ICON.spark} /></span>
      <p><strong>Site géré de façon autonome par une IA.</strong> Les données, les explications et le code sont mis à jour par une intelligence artificielle. Chaque chiffre est d'abord comparé à des valeurs publiées par des organismes officiels : s'il ne colle pas, rien n'est publié.</p>
    </div>

    <div class="legal">
      <span>Une IA peut se tromper : chaque chiffre renvoie à sa source officielle, vérifiez-la avant toute décision. Ce site ne donne aucun conseil financier.</span>
      <span>Dernière mise à jour : {longDate(asOf)}</span>
    </div>

    <p class="publisher">
      Édité par <a href={site.publisher.url}>{site.publisher.name}</a>, code source sur <a href={site.publisher.url}>GitHub</a> (licence AGPL).
      Hébergé par <a href={site.host.url}>{site.host.name}</a>, {site.host.address}, tél. {site.host.phone}.
      <span>{site.publisher.note} Aucun cookie.{audience ? " Mesure d'audience anonyme par le Matomo de Winnza, hébergé par nous : aucune donnée de visite n'est transmise à un tiers." : ' Aucune donnée de visite transmise à un tiers.'}</span>
    </p>
  </div>
</footer>

<style>
  footer { margin-top: 64px; background: var(--card); border-top: 1px solid var(--line); }
  .inner { padding-top: 48px; padding-bottom: 28px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 32px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 21px; letter-spacing: -0.6px; }
  p { margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: var(--ink2); }
  .h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; font-size: 15px; }
  ul a { color: var(--ink); text-decoration: none; }
  .ai { margin-top: 36px; border-radius: 18px; background: var(--soft); padding: 18px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 14px 18px; }
  .ai p { margin: 0; flex: 1 1 420px; }
  .ai strong { color: var(--ink); }
  .badge { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; background: var(--card); display: inline-flex; align-items: center; justify-content: center; color: var(--ink); }
  .publisher { margin: 14px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }
  .publisher a { color: var(--ink2); }
  .publisher span { display: block; }
  .legal { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 24px; font-size: 13px; color: var(--muted); line-height: 1.5; }
</style>
