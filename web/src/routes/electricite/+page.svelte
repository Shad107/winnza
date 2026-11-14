<script lang="ts">
  // Le vrai prix du kWh : le tarif affiché, ce qu'il coûte vraiment une fois l'abonnement compté, où va
  // l'argent, le tarif depuis 2012, la couleur Tempo du jour et nos voisins européens.
  import Toggle from '#lib/components/Toggle.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import StackedBar from '#lib/components/StackedBar.svelte';
  import RankBars from '#lib/components/RankBars.svelte';
  import ColumnsChart from '#lib/components/ColumnsChart.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import Faq from '#lib/components/Faq.svelte';
  import NextPages from '#lib/components/NextPages.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { ICON, KWH_PARTS, KWH_META, KWH_SEGMENTS, type Segment } from '#lib/parts.ts';
  import { AXIS } from '#lib/chart.ts';
  import { eur0, eur2, eur4, longDate, percent } from '#lib/format.ts';
  import { FLAG } from '#lib/flags.ts';
  import { PAGES } from '#lib/site-nav.ts';
  import type { TempoColor } from '@winnza/core/plugins/electricity/decl.js';
  import { untrack } from 'svelte';

  let { data } = $props();
  const el = $derived(data.electricity);
  // valeurs de départ lues en base : la première option, la première puissance, la consommation déclarée
  let optionId = $state(untrack(() => data.electricity.options[0]!.id));
  let kvaId = $state(untrack(() => String(data.electricity.options[0]!.powers[0]!.kva)));
  let kwhYear = $state(untrack(() => data.electricity.consumption.default));

  const option = $derived(el.options.find((o) => o.id === optionId) ?? el.options[0]!);
  const power = $derived(option.powers.find((p) => String(p.kva) === kvaId) ?? option.powers[0]!);
  const kva = $derived(power.kva);
  const basePower = $derived(el.options.find((o) => o.id === 'base')?.powers.find((p) => p.kva === kva) ?? null);
  const baseKwh = $derived(basePower?.periods[0] ?? null);
  // le vrai prix du kWh (option Base) : l'abonnement réparti sur la consommation de l'année
  const truePrice = $derived(basePower && baseKwh ? baseKwh.ttc + basePower.subscriptionTtc / kwhYear : null);
  const bill = $derived(basePower && baseKwh ? basePower.subscriptionTtc + baseKwh.ttc * kwhYear : null);

  // le kWh affiché découpé : hors taxes, accise, TVA (mêmes couleurs que les parts « taxes » et « TVA »)
  const TRV_SEGMENTS: readonly Segment[] = [
    { key: 'ht', label: 'Hors taxes : énergie, réseau, fournisseur', short: 'Hors taxes', color: 'var(--s1)', ink: 'var(--on-s1)', icon: ICON.drop, description: '' },
    { key: 'excise', label: "Accise sur l'électricité", short: 'Accise', color: 'var(--s3)', ink: 'var(--on-s3)', icon: ICON.state, description: '' },
    { key: 'vat', label: 'TVA', short: 'TVA', color: 'var(--s4)', ink: 'var(--on-s4)', icon: ICON.percent, description: '' },
  ];
  const first = $derived(power.periods[0]!);
  const trvValues = $derived({ ht: first.ht, excise: first.excise, vat: first.vat });
  const taxShare = $derived(percent(first.excise + first.vat, first.ttc));

  // Eurostat : le pays de référence, dernière année
  const ref = $derived(el.europe.countries.find((c) => c.code === el.europe.reference) ?? null);
  const refParts = $derived(ref?.parts ?? null);
  const refTotal = $derived(refParts ? KWH_PARTS.reduce((s, k) => s + refParts[k], 0) : 0);
  const shares = $derived(refParts ? Object.fromEntries(KWH_PARTS.map((k) => [k, refParts[k] / refTotal > 0.09 ? percent(refParts[k], refTotal) : ''])) : {});
  const ranked = $derived(el.europe.countries.filter((c) => c.price !== null).sort((a, b) => a.price! - b.price!));
  const refRank = $derived(ranked.findIndex((c) => c.code === el.europe.reference) + 1);
  const semesterLabel = (iso: string) => `${iso.slice(5, 7) === '01' ? '1er' : '2e'} semestre ${iso.slice(0, 4)}`;

  // historique : une graduation tous les deux ans
  const monthLabel = (iso: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
  const years = $derived(el.history.months.flatMap((m, i) => (m.endsWith('-01-01') && Number(m.slice(0, 4)) % 2 === 0 ? [{ index: i, label: m.slice(0, 4) }] : [])));
  const LINE_COLORS = ['var(--ink)', 'var(--s1)', 'var(--s2)'];
  const histFirst = $derived(el.history.series[0]?.values.find((v) => v > 0) ?? 0);
  const histLast = $derived(el.history.series[0]?.values.at(-1) ?? 0);

  const TEMPO_LABEL = { blue: 'bleu', white: 'blanc', red: 'rouge' } satisfies Record<TempoColor, string>;
  const tempoPrices = $derived(el.options.find((o) => o.id === 'tempo')?.powers.find((p) => p.kva === kva) ?? null);

  const faq = $derived([
    ...(baseKwh && basePower ? [
      { q: 'Quel est le prix du kWh en ce moment ?', a: `Au tarif réglementé (tarif Bleu), option Base, ${kva} kVA : ${eur4(baseKwh.ttc)} le kWh toutes taxes comprises depuis le ${longDate(basePower.since)}, plus un abonnement de ${eur2(basePower.subscriptionTtc)} par an.` },
      { q: 'Pourquoi le vrai prix du kWh est-il plus élevé que le tarif affiché ?', a: `Parce que l'abonnement se paie en plus, quelle que soit votre consommation. Pour ${kwhYear.toLocaleString('fr-FR')} kWh par an, il ajoute ${eur4(basePower.subscriptionTtc / kwhYear)} à chaque kWh : le vrai prix monte à ${eur4(truePrice ?? 0)}. Moins vous consommez, plus l'abonnement pèse.` },
      { q: "Combien de taxes sur l'électricité ?", a: `Sur un kWh à ${eur4(baseKwh.ttc)} : ${eur4(baseKwh.excise)} d'accise sur l'électricité (l'ancienne CSPE) et ${eur4(baseKwh.vat)} de TVA, soit ${percent(baseKwh.excise + baseKwh.vat, baseKwh.ttc)} du prix. La TVA de ${Math.round(el.kwhVat.rate * 100)} % s'applique aussi à l'accise.` },
    ] : []),
    ...(el.tempo ? [{ q: "C'est quoi l'option Tempo ?", a: `Un tarif dont le prix change selon la couleur du jour, fixée par RTE la veille : ${el.tempo.quota.red} jours rouges très chers et ${el.tempo.quota.white} jours blancs par saison, le reste en bleu, le moins cher. Aujourd'hui, le ${longDate(el.tempo.date)}, c'est un jour ${TEMPO_LABEL[el.tempo.color]}.` }] : []),
  ]);
</script>

<Seo site={data.site} page={{ path: '/electricite', title: "Prix du kWh d'électricité : le vrai prix, taxes et abonnement compris | Winnza",
  description: `Le prix du kWh au tarif réglementé (Base, heures creuses, Tempo), ce qu'il coûte vraiment une fois l'abonnement compté, la part des taxes, la couleur Tempo du jour et le prix chez nos voisins. Chiffres de la CRE et d'Eurostat.`,
  faq, modified: el.asOf }} />

<main class="wrap">
  <section class="page-head" aria-labelledby="titre">
    <p class="chip"><Icon name={ICON.chart} size={16} />Tarifs officiels de la CRE et d'Eurostat</p>
    <h1 class="h1" id="titre">Le vrai prix du kWh</h1>
    <p class="intro">Le prix affiché sur la facture n'est pas ce que vous payez vraiment : l'abonnement s'ajoute{#if baseKwh}, et {percent(baseKwh.excise + baseKwh.vat, baseKwh.ttc)} du kWh part en taxes{/if}. Voici le kWh découpé, comme le litre.</p>
    <div class="controls">
      <Toggle label="Option" bind:value={optionId} options={el.options.map((o) => ({ id: o.id, label: o.label }))} />
      <Toggle label="Puissance" bind:value={kvaId} options={option.powers.map((p) => ({ id: String(p.kva), label: `${p.kva} kVA` }))} />
    </div>
  </section>

  <section class="section" aria-labelledby="affiche" style="padding-top: 24px">
    <div class="card pad">
      <h2 class="h3" id="affiche">Tarif Bleu {option.label}, {power.kva} kVA</h2>
      <p class="sub-line">Tarif réglementé en vigueur depuis le {longDate(power.since)}, toutes taxes comprises.</p>
      <ul class="prices" class:many={power.periods.length > 2}>
        {#each power.periods as p (p.id)}
          <li class:tempo={p.tempo !== null} data-tempo={p.tempo}>
            <span class="p-label">{#if p.tempo}<span class="dot" data-tempo={p.tempo} aria-hidden="true"></span>{/if}{p.label}</span>
            <span class="p-value">{eur4(p.ttc)}</span><span class="p-unit">le kWh</span>
          </li>
        {/each}
        <li class="subscription"><span class="p-label">Abonnement</span><span class="p-value">{eur2(power.subscriptionTtc)}</span><span class="p-unit">par an, soit {eur2(power.subscriptionTtc / 12)} par mois</span></li>
      </ul>
      <h3 class="h4">Dans {eur4(first.ttc)} ({first.label.toLowerCase()}), {taxShare} de taxes</h3>
      <div class="bar-wrap"><StackedBar parts={TRV_SEGMENTS} values={trvValues} texts={{ ht: eur4(first.ht), excise: '', vat: '' }}
        label="{first.label} : hors taxes {eur4(first.ht)}, accise {eur4(first.excise)}, TVA {eur4(first.vat)}" /></div>
      <ul class="keys">
        {#each TRV_SEGMENTS as s (s.key)}<li><span class="sw" style:background={s.color}></span>{s.label} : <strong>{eur4(trvValues[s.key as keyof typeof trvValues])}</strong></li>{/each}
      </ul>
    </div>
  </section>

  {#if truePrice !== null && bill !== null && basePower && baseKwh}
    <section class="section" aria-labelledby="vrai">
      <h2 class="h2" id="vrai">Le vrai prix, abonnement compris</h2>
      <p class="lead">L'abonnement se paie même si vous ne consommez rien. Réparti sur votre consommation, il renchérit chaque kWh, d'autant plus que vous consommez peu.</p>
      <div class="card pad">
        <div class="slider">
          <label for="kwh"><span>Ma consommation</span><span>{kwhYear.toLocaleString('fr-FR')} kWh par an</span></label>
          <input id="kwh" type="range" min={el.consumption.min} max={el.consumption.max} step={el.consumption.step} bind:value={kwhYear} />
        </div>
        <div class="headline">
          <span class="mid">{eur4(truePrice)}</span>
          <span class="sub">le kWh réellement payé en option Base, {kva} kVA, au lieu de {eur4(baseKwh.ttc)} affichés, soit {percent(truePrice - baseKwh.ttc, baseKwh.ttc)} de plus. Facture annuelle : {eur0(bill)}.</span>
        </div>
        <div class="thin" role="img" aria-label="Part de l'abonnement dans la facture : {percent(basePower.subscriptionTtc, bill)}">
          <span style:flex-grow={baseKwh.ttc * kwhYear} style:background="var(--s1)"></span><span style:flex-grow={basePower.subscriptionTtc} style:background="var(--s2)"></span>
        </div>
        <div class="thin-legend"><span>Consommation : {eur0(baseKwh.ttc * kwhYear)}</span><span>Abonnement : {eur0(basePower.subscriptionTtc)} ({percent(basePower.subscriptionTtc, bill)})</span></div>
      </div>
    </section>
  {/if}

  {#if refParts && ref}
    <section class="section" aria-labelledby="parts">
      <h2 class="h2" id="parts">Où va l'argent d'un kWh</h2>
      <p class="lead">Le prix moyen payé en {el.europe.year} par un {el.bandLabel}, abonnement compris, toutes offres confondues : {eur4(refTotal)} le kWh.</p>
      <div class="card pad">
        <div class="bar-wrap"><StackedBar parts={KWH_SEGMENTS} values={refParts} texts={shares} label="Répartition du kWh en {el.europe.year} : {KWH_PARTS.map((k) => `${KWH_META[k].short} ${eur4(refParts[k])}`).join(', ')}" /></div>
        <div class="grid-cards four">
          {#each KWH_SEGMENTS as s (s.key)}
            <div class="part">
              <div class="part-head"><span class="sw big" style:background={s.color}></span>{s.label}</div>
              <div class="part-value">{eur4(refParts[s.key as keyof typeof refParts])}</div>
              <p>{s.description}</p>
            </div>
          {/each}
        </div>
      </div>
      {#if el.annual.length > 1}
        <div class="card pad" style="margin-top: 16px">
          <h3 class="h4" style="margin-top: 0">Année par année, depuis {el.annual[0]!.year}</h3>
          <ColumnsChart parts={KWH_SEGMENTS} rows={el.annual} axis={AXIS.kwh} highlight={[el.annual[0]!.year, el.annual.at(-1)!.year]}
            label="Décomposition du prix moyen d'un kWh par année depuis {el.annual[0]!.year} : énergie, réseau, taxes, TVA." />
        </div>
      {/if}
    </section>
  {/if}

  {#if el.history.series.length}
    <section class="section" aria-labelledby="histoire">
      <h2 class="h2" id="histoire">Le tarif réglementé depuis {el.history.months[0]?.slice(0, 4)}</h2>
      <p class="lead">Le kWh de l'option Base ({el.history.kva} kVA) est passé de {eur4(histFirst)} à {eur4(histLast)}, soit {percent(histLast - histFirst, histFirst)} de hausse.</p>
      <div class="card pad">
        <LineChart labels={el.history.months.map(monthLabel)} {years} axis={AXIS.kwh}
          series={el.history.series.map((s, i) => ({ key: s.key, label: s.label, color: LINE_COLORS[i % LINE_COLORS.length]!, values: s.values }))}
          label="Prix du kWh toutes taxes comprises au tarif réglementé, chaque mois depuis {el.history.months[0]?.slice(0, 4)}. Flèches gauche et droite pour parcourir." />
      </div>
    </section>
  {/if}

  {#if el.tempo}
    {@const t = el.tempo}
    <section class="section" aria-labelledby="tempo">
      <h2 class="h2" id="tempo">Tempo : aujourd'hui, jour {TEMPO_LABEL[t.color]}</h2>
      <div class="grid-cards two">
        <div class="card pad today" data-tempo={t.color}>
          <div class="t-date">{longDate(t.date)}</div>
          <div class="t-color"><span class="dot big" data-tempo={t.color} aria-hidden="true"></span>Jour {TEMPO_LABEL[t.color]}</div>
          {#if tempoPrices}
            {@const hp = tempoPrices.periods.find((p) => p.tempo === t.color && p.id.endsWith('-hp'))}
            {@const hc = tempoPrices.periods.find((p) => p.tempo === t.color && p.id.endsWith('-hc'))}
            {#if hp && hc}<p class="t-prices">{eur4(hp.ttc)} le kWh en heures pleines, {eur4(hc.ttc)} en heures creuses ({kva} kVA).</p>{/if}
          {/if}
          {#if t.tomorrow}<p class="t-next">Demain : jour {TEMPO_LABEL[t.tomorrow]}.</p>{/if}
        </div>
        <div class="card pad">
          <h3 class="h4" style="margin-top: 0">Saison {t.season.replace('-', ' à ')}</h3>
          <ul class="quota">
            <li><span class="q-label"><span class="dot" data-tempo="red" aria-hidden="true"></span>Jours rouges</span><span><strong>{t.used.red}</strong> passés sur {t.quota.red}, encore {Math.max(0, t.quota.red - t.used.red)}</span></li>
            <li><span class="q-label"><span class="dot" data-tempo="white" aria-hidden="true"></span>Jours blancs</span><span><strong>{t.used.white}</strong> passés sur {t.quota.white}, encore {Math.max(0, t.quota.white - t.used.white)}</span></li>
            <li><span class="q-label"><span class="dot" data-tempo="blue" aria-hidden="true"></span>Jours bleus</span><span><strong>{t.used.blue}</strong> passés</span></li>
          </ul>
          <p class="caption">Nombre de jours par saison : <a href={t.quotaSource.url}>{t.quotaSource.name}</a>. Couleur relevée chaque matin.</p>
        </div>
      </div>
    </section>
  {/if}

  {#if ranked.length}
    <section class="section" aria-labelledby="europe">
      <h2 class="h2" id="europe">Et chez nos voisins ?</h2>
      <p class="lead">Prix moyen du kWh payé par les ménages au {semesterLabel(el.europe.semester)}, abonnement et taxes compris.{#if refRank}{' '}La France est {refRank === 1 ? 'la moins chère' : `${refRank}e sur ${ranked.length}`}, du moins cher au plus cher.{/if}</p>
      <div class="card pad">
        <RankBars label="Prix moyen du kWh par pays, du moins cher au plus cher"
          items={ranked.map((c) => ({ key: c.code, label: c.label, value: c.price!, text: eur4(c.price!), highlight: c.code === el.europe.reference, flag: FLAG[c.code] }))} />
      </div>
    </section>
  {/if}

  <section class="section" aria-label="Sources">
    <p class="caption">Sources :
      {#each el.sources as s, i (s.url)}<a href={s.url}>{s.name}</a> ({s.publisher}){i < el.sources.length - 1 ? ' ; ' : '.'}{/each}
      Accise et TVA calculées à partir des prix hors taxes et toutes taxes comprises de la CRE, avec un taux de TVA de {Math.round(el.kwhVat.rate * 100)} % sur le kWh (<a href={el.kwhVat.source.url}>{el.kwhVat.source.name}</a>).
    </p>
  </section>

  <Faq items={faq} />
  <NextPages links={PAGES} />
</main>

<style>
  .h3 { margin: 0; font-size: 20px; letter-spacing: -0.3px; }
  .h4 { margin: 26px 0 0; font-size: 17px; }
  .sub-line { margin: 6px 0 0; font-size: 14px; color: var(--ink2); }
  .prices { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .prices li { background: var(--soft); border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
  .p-label { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--ink2); }
  .p-value { font-size: 26px; font-weight: 800; letter-spacing: -0.6px; }
  .p-unit { font-size: 13px; color: var(--muted); }
  .bar-wrap { margin-top: 14px; }
  .keys { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 14px; color: var(--ink2); }
  .keys li { display: inline-flex; align-items: center; gap: 8px; }
  .sw { width: 12px; height: 12px; border-radius: 4px; flex: 0 0 auto; }
  .sw.big { width: 14px; height: 14px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; box-shadow: 0 0 0 1px var(--line); }
  .dot.big { width: 22px; height: 22px; }
  .dot[data-tempo='blue'] { background: var(--down-strong); }
  .dot[data-tempo='white'] { background: #ffffff; box-shadow: 0 0 0 1px var(--muted); }
  .dot[data-tempo='red'] { background: var(--up-strong); }
  .slider { margin-top: 4px; }
  .thin { display: flex; gap: 2px; height: 12px; margin-top: 18px; }
  .thin span { border-radius: 999px; }
  .thin-legend { display: flex; justify-content: space-between; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin-top: 6px; gap: 4px 12px; }
  .four { margin-top: 18px; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
  .part-head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
  .part-value { font-size: 22px; font-weight: 800; margin-top: 6px; }
  .part p { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--ink2); }
  .two { margin-top: 8px; }
  .t-date { font-size: 14px; color: var(--muted); }
  .t-color { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 800; letter-spacing: -0.6px; margin-top: 8px; }
  .t-prices, .t-next { margin: 10px 0 0; font-size: 15px; color: var(--ink2); line-height: 1.5; }
  .quota { list-style: none; margin: 12px 0 0; padding: 0; }
  .quota li { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; padding: 10px 0; border-top: 1px solid var(--line); font-size: 15px; }
  .quota li:first-child { border-top: 0; }
  .q-label { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
</style>
