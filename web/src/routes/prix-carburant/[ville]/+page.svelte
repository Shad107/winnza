<script lang="ts">
  // Le prix du carburant dans une ville : la moyenne du jour de chaque carburant, la station la moins
  // chère, l'écart au département et à la France, chaque station, et les villes voisines.
  import Icon from '#lib/components/Icon.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur0, eur3, longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import { CITY_PATH } from '@winnza/core/pages/cities.js';
  import { CHANGE_DAYS } from '@winnza/core/pages/departments-page.js';

  let { data } = $props();
  const c = $derived(data.city);
  const FILL_LITRES = 50;
  const stationName = (key: string) => { const s = c.stations.find((x) => x.key === key); return s ? (s.name ?? s.address) : ''; };
  const cents = (v: number) => { const n = Math.round(v * 100); return n === 0 ? 'au même prix' : `${Math.abs(n)} centime${Math.abs(n) > 1 ? 's' : ''} ${n > 0 ? 'plus cher' : 'moins cher'}`; };
  const km = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 })} km`;
  const first = $derived(c.fuels[0]);
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

  const faq = $derived(c.fuels.slice(0, 3).flatMap((f) => {
    const out = [{ q: `Quel est le prix du ${f.label.toLowerCase()} à ${c.name} aujourd'hui ?`, a: `${eur3(f.avg)} le litre en moyenne le ${longDate(data.date)}, sur ${plural(f.count, 'station')} à prix à jour.${f.department !== null ? ` C'est ${cents(f.avg - f.department)} que la moyenne du département (${eur3(f.department)}).` : ''}` }];
    if (f.count > 1) out.push({ q: `Où trouver le ${f.label.toLowerCase()} le moins cher à ${c.name} ?`, a: `${stationName(f.cheapest.key)}, à ${eur3(f.cheapest.price)} le litre, soit ${eur0((f.avg - f.cheapest.price) * FILL_LITRES)} d'économie sur un plein de ${FILL_LITRES} litres par rapport à la moyenne de la ville.` });
    return out;
  }));
</script>

<Seo site={data.site} page={{ path: `${CITY_PATH}/${c.slug}`, title: `Prix essence et gazole à ${c.name} (${c.dep}) aujourd'hui | Winnza`,
  description: `${first ? `${first.label} à ${eur3(first.avg)} en moyenne à ${c.name} aujourd'hui. ` : ''}Le prix du jour de chaque carburant dans ${plural(c.stations.length, 'station')} de ${c.name} (${c.depLabel}), et la moins chère. Prix officiels.`,
  faq, modified: data.date }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels relevés le {longDate(data.date)}</p>
    <h1 class="h1" id="titre">Le prix du carburant à {c.name}</h1>
    <p class="intro">{plural(c.stations.length, 'station')} à {c.name} ({c.depLabel}, {c.cps.join(', ')}). Prix moyen du jour de chaque carburant, calculé sur les prix mis à jour dans la semaine.</p>
  </section>

  {#if c.fuels.length}
    <section class="section" aria-label="Prix du jour" style="padding-top: 20px">
      <div class="grid-cards fuels">
        {#each c.fuels as f (f.id)}
          <div class="card fuel">
            <div class="f-label">{f.label}</div>
            <div class="f-avg">{eur3(f.avg)}</div>
            <div class="f-sub">le litre en moyenne, {plural(f.count, 'station')}</div>
            {#if f.count > 1}<div class="f-line">La moins chère : <strong>{eur3(f.cheapest.price)}</strong>, {stationName(f.cheapest.key)}</div>{/if}
            {#if f.department !== null}<div class="f-line">{cents(f.avg - f.department)} que le département</div>{/if}
            {#if f.france !== null}<div class="f-line">{cents(f.avg - f.france)} que la France</div>{/if}
            {#if f.change !== null}<div class="f-line">Sur {CHANGE_DAYS} jours : {Math.round(f.change * 100) === 0 ? 'stable' : `${f.change > 0 ? '+' : '−'}${Math.abs(Math.round(f.change * 100))} ct`}</div>{/if}
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="section"><p class="lead">Aucune station de {c.name} n'a mis ses prix à jour cette semaine.</p></section>
  {/if}

  <section class="section" aria-labelledby="stations">
    <h2 class="h2" id="stations">{c.stations.length > 1 ? `Les ${c.stations.length} stations` : 'La station'} de {c.name}</h2>
    <ul class="stations">
      {#each c.stations as s (s.key)}
        <li class="card st">
          <div class="st-head"><strong>{s.name ?? s.address}</strong>{#if s.h24}<span class="tag">24 h/24</span>{/if}</div>
          {#if s.name}<div class="st-addr">{s.address}</div>{/if}
          <ul class="st-prices">
            {#each c.fuels as f (f.id)}
              {#if s.prices[f.id] !== undefined}<li class:best={f.count > 1 && f.cheapest.key === s.key}><span>{f.label}</span><strong>{eur3(s.prices[f.id]!)}</strong></li>{/if}
            {/each}
          </ul>
          {#if !Object.keys(s.prices).length}<div class="st-addr">Prix non mis à jour cette semaine.</div>{/if}
        </li>
      {/each}
    </ul>
    <p class="caption">Source : flux officiel des prix des carburants (ministère de l'Économie). Noms des stations : © contributeurs OpenStreetMap. <a href="/carte-des-stations">Voir toutes les stations sur la carte</a>.</p>
  </section>

  {#if c.nearby.length}
    <section class="section" aria-labelledby="voisines">
      <h2 class="h2" id="voisines">Les villes voisines</h2>
      <ul class="chips">{#each c.nearby as n (n.slug)}<li><a href="{CITY_PATH}/{n.slug}">{n.name} <span>{km(n.km)}</span></a></li>{/each}</ul>
      <p class="caption"><a href={CITY_PATH}>Toutes les villes</a> · <a href="/prix-par-departement">Les prix par département</a></p>
    </section>
  {/if}

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .fuels { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .fuel { padding: 18px 20px; border-radius: 20px; }
  .f-label { font-weight: 700; font-size: 15px; color: var(--ink2); }
  .f-avg { font-size: 30px; font-weight: 800; letter-spacing: -0.8px; margin-top: 6px; }
  .f-sub { font-size: 13px; color: var(--muted); }
  .f-line { font-size: 14px; color: var(--ink2); margin-top: 8px; line-height: 1.4; }
  .stations { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .st { padding: 16px 18px; border-radius: 18px; }
  .st-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; font-size: 15px; }
  .tag { flex: 0 0 auto; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: var(--soft); color: var(--ink2); }
  .st-addr { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .st-prices { list-style: none; margin: 10px 0 0; padding: 0; }
  .st-prices li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-top: 1px solid var(--line); font-size: 14px; }
  .st-prices li.best strong::before { content: '● '; color: var(--s3); }
  .chips { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chips a { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; background: var(--card); box-shadow: var(--shadow); color: var(--ink); font-weight: 600; text-decoration: none; }
  .chips span { color: var(--muted); font-weight: 400; font-size: 13px; }
</style>
