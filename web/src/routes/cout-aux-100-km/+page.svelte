<script lang="ts">
  // Combien coûtent 100 km : chaque motorisation, sa consommation et son prix du jour, côte à côte. Le
  // visiteur remplace les consommations moyennes par celles de sa voiture.
  import { untrack } from 'svelte';
  import Icon from '#lib/components/Icon.svelte';
  import RankBars from '#lib/components/RankBars.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON } from '#lib/parts.ts';
  import { eur0, eur2, eur4, longDate } from '#lib/format.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import { ENERGY_UNIT, type EnergyUnit } from '@winnza/core/plugins/running-cost/index.js';
  import { PRICE_KIND } from '@winnza/core/pages/running-cost-page.js';

  let { data } = $props();
  const cost = $derived(data.cost);
  // consommations et distance de départ : les moyennes déclarées, lues en base
  let mine = $state<Record<string, number>>(untrack(() => Object.fromEntries(data.cost.consumptions.map((c) => [c.id, c.value]))));
  let km = $state(untrack(() => data.cost.distance.default));

  const fmtNumber = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const unitPrice = (u: EnergyUnit, v: number) => (u === ENERGY_UNIT.kwh ? eur4(v) : eur2(v));
  const rows = $derived(cost.rows.map((r) => {
    const base = mine[r.consumptionId];
    const consumption = (base && base > 0 ? base : r.consumption / (r.factor?.value ?? 1)) * (r.factor?.value ?? 1);
    return { ...r, consumption, per100: consumption * r.price };
  }).sort((a, b) => a.per100 - b.per100));
  const cheapest = $derived(rows[0]);
  // le thermique le moins cher du jour, quel qu'il soit
  const thermal = $derived(rows.find((r) => r.unit === ENERGY_UNIT.litre));
  const evHome = $derived(rows.find((r) => r.unit === ENERGY_UNIT.kwh && r.priceKind === PRICE_KIND.regulated));
  const evFast = $derived(rows.find((r) => r.unit === ENERGY_UNIT.kwh && r.priceKind === PRICE_KIND.declared));
  const PRICE_ORIGIN = { pump: 'prix du jour', regulated: 'tarif réglementé', declared: 'relevé' } satisfies Record<(typeof PRICE_KIND)[keyof typeof PRICE_KIND], string>;

  const faq = $derived([
    ...(thermal && evHome ? [{ q: 'Électrique ou thermique : qu\'est-ce qui coûte le moins cher au kilomètre ?', a: `Au prix du jour, le thermique le moins cher est « ${thermal.label.toLowerCase()} » : ${eur2(thermal.per100)} les 100 km (${fmtNumber(thermal.consumption)} L). En électrique rechargée à la maison au ${evHome.priceLabel}, c'est ${eur2(evHome.per100)} (${fmtNumber(evHome.consumption)} kWh). Sur ${km.toLocaleString('fr-FR')} km par an, l'écart est de ${eur0(Math.abs(thermal.per100 - evHome.per100) * km / 100)} en faveur ${thermal.per100 > evHome.per100 ? "de l'électrique" : 'du thermique'}.` }] : []),
    ...(evFast && evHome ? [{ q: 'Et en rechargeant sur borne rapide ?', a: `Sur borne rapide sans abonnement (${eur4(evFast.price)} le kWh, ${evFast.priceSource?.name ?? 'relevé'} du ${longDate(evFast.priceDate)}), 100 km coûtent ${eur2(evFast.per100)}, soit ${Math.round(evFast.per100 / evHome.per100 * 10) / 10} fois plus qu'à la maison.` }] : []),
    { q: 'Ce coût comprend-il tout ?', a: "Non : seulement l'énergie. L'achat de la voiture, l'entretien, l'assurance et, pour l'électrique, l'abonnement d'électricité (que vous payez déjà pour votre logement) n'y sont pas." },
  ]);
</script>

<Seo site={data.site} page={{ path: '/cout-aux-100-km', title: 'Coût aux 100 km : diesel, essence, E85, GPL ou électrique, au prix du jour | Winnza',
  description: "Combien coûtent 100 km en diesel, essence, E85, GPL ou voiture électrique rechargée à la maison ou sur borne ? Au prix du jour, avec la consommation de votre voiture. Chiffres officiels et sources.",
  faq, modified: cost.rows.map((r) => r.priceDate).sort().at(-1) }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Prix du jour en station et tarif réglementé</p>
    <h1 class="h1" id="titre">Combien coûtent 100&#160;km&#160;?</h1>
    <p class="intro">Chaque motorisation côte à côte, au prix du jour. Les consommations sont des moyennes publiées : remplacez-les par celles de votre voiture.</p>
  </section>

  <section class="section" aria-label="Ma voiture" style="padding-top: 20px">
    <div class="card pad">
      <div class="inputs">
        {#each cost.consumptions as c (c.id)}
          <label class="field">
            <span class="f-label">{c.label}</span>
            <span class="f-input"><input type="number" inputmode="decimal" min="0.1" step="0.1" bind:value={mine[c.id]} /><span>{c.unit} aux 100 km</span></span>
          </label>
        {/each}
      </div>
      <div class="slider">
        <label for="km"><span>Je roule</span><span>{km.toLocaleString('fr-FR')} km par an</span></label>
        <input id="km" type="range" min={cost.distance.min} max={cost.distance.max} step={cost.distance.step} bind:value={km} />
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="classement">
    <h2 class="h2" id="classement">{#if cheapest}Le moins cher aujourd'hui : {eur2(cheapest.per100)} les 100 km{/if}</h2>
    {#if cheapest}<p class="lead">{cheapest.label}.</p>{/if}
    <div class="card pad">
      <RankBars label="Coût de 100 km par motorisation, du moins cher au plus cher"
        items={rows.map((r) => ({ key: r.id, label: r.label, value: r.per100, text: eur2(r.per100), highlight: r === cheapest,
          sub: `${fmtNumber(r.consumption)} ${r.unit} à ${unitPrice(r.unit, r.price)} (${PRICE_ORIGIN[r.priceKind]}), soit ${eur0(r.per100 * km / 100)} par an` }))} />
    </div>
  </section>

  <section class="section" aria-labelledby="sources">
    <h2 class="h2" id="sources">D'où viennent les chiffres</h2>
    <div class="card pad notes">
      <h3>Les consommations</h3>
      <ul>
        {#each cost.consumptions as c (c.id)}<li><strong>{fmtNumber(c.value)} {c.unit} aux 100 km</strong> : {c.label} (<a href={c.source.url}>{c.source.name}</a>).</li>{/each}
        {#each cost.rows.filter((r) => r.factor) as r (r.id)}<li><strong>{r.label}</strong> : {r.factor!.why} (<a href={r.factor!.source.url}>{r.factor!.source.name}</a>).</li>{/each}
      </ul>
      <h3>Les prix</h3>
      <ul>
        {#each cost.rows as r (r.id)}
          <li><strong>{r.label}</strong> : {unitPrice(r.unit, r.price)} le {r.unit === ENERGY_UNIT.kwh ? 'kWh' : 'litre'}, {r.priceLabel}
            {#if r.priceKind === PRICE_KIND.pump}, relevé le {longDate(r.priceDate)}{:else if r.priceKind === PRICE_KIND.regulated}, en vigueur depuis le {longDate(r.priceDate)}{:else}, relevé du {longDate(r.priceDate)} (<a href={r.priceSource?.url}>{r.priceSource?.name}</a>){/if}.</li>
        {/each}
      </ul>
      <p class="caption">Distance par défaut : <a href={cost.distance.source.url}>{cost.distance.source.name}</a>. Le GNV et l'hydrogène ne figurent pas ici : aucun prix public, daté et toutes taxes comprises n'a été trouvé. Ils seront ajoutés quand il y en aura un.</p>
    </div>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .inputs { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .f-label { display: block; font-size: 14px; font-weight: 600; color: var(--ink2); }
  .f-label::first-letter { text-transform: uppercase; }
  .f-input { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted); }
  .f-input input { width: 90px; min-height: 44px; border: 1px solid var(--line); border-radius: 12px; padding: 0 12px; font: 600 16px 'Inter Variable', system-ui, sans-serif; background: var(--card); color: var(--ink); }
  .slider { margin-top: 20px; }
  .notes h3 { margin: 0 0 8px; font-size: 17px; }
  .notes h3:not(:first-child) { margin-top: 20px; }
  .notes ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.6; color: var(--ink2); }
</style>
