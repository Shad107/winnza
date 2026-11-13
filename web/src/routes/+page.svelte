<script lang="ts">
  import Toggle from '#lib/components/Toggle.svelte';
  import StackedBar from '#lib/components/StackedBar.svelte';
  import PartCard from '#lib/components/PartCard.svelte';
  import Jerrycan from '#lib/components/Jerrycan.svelte';
  import ColumnsChart from '#lib/components/ColumnsChart.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Seo from '#lib/plugins/seo/Seo.svelte';
  import { LITRE_PARTS, PART_META, ICON, type LitrePart } from '#lib/parts.ts';
  import { eur2, money, signed, percent, longDate, NBSP_PERCENT } from '#lib/format.ts';
  import { FLAG } from '#lib/flags.ts';

  let { data } = $props();
  const page = $derived(data.page);

  const UNIT = { litre: 'litre', fill: 'fill' } as const;
  type UnitId = (typeof UNIT)[keyof typeof UNIT];

  let productId = $state('diesel');
  let unit = $state<UnitId>(UNIT.litre);
  let litres = $state(50);

  const p = $derived(page.products.find((x) => x.id === productId) ?? page.products[0]!);
  const name = $derived(p.label.toLowerCase());
  const perLitre = $derived(unit === UNIT.litre);
  const k = $derived(perLitre ? 1 : litres);
  const sum = (b: Record<LitrePart, number>) => LITRE_PARTS.reduce((s, key) => s + b[key], 0);
  const scaled = (b: Record<LitrePart, number>) =>
    Object.fromEntries(LITRE_PARTS.map((key) => [key, b[key] * k])) as Record<LitrePart, number>;

  const now = $derived(scaled(p.now));
  const ref = $derived(scaled(p.reference));
  const total = $derived(sum(now));
  const total08 = $derived(sum(ref));
  const taxes = $derived(now.excise + now.vat);
  /** taux de TVA déduit des données (TVA / prix avant TVA), pas écrit à la main */
  const vatRate = $derived(p.now.vat / (p.litre - p.now.vat));

  /** texte dans une part seulement si elle est assez large pour le porter sans le couper */
  const fitText = (values: Record<LitrePart, number>, whole: number, width = 1) =>
    Object.fromEntries(LITRE_PARTS.map((key) => [key, (values[key] / whole) * width > 0.13 ? money(values[key], perLitre) : ''])) as Record<LitrePart, string>;
  const allText = (values: Record<LitrePart, number>) =>
    Object.fromEntries(LITRE_PARTS.map((key) => [key, money(values[key], perLitre)])) as Record<LitrePart, string>;
  const shareText = (values: Record<LitrePart, number>, whole: number) =>
    Object.fromEntries(LITRE_PARTS.map((key) => [key, values[key] / whole > 0.09 ? percent(values[key], whole) : ''])) as Record<LitrePart, string>;
  const describe = (values: Record<LitrePart, number>, prefix: string) =>
    prefix + ' : ' + LITRE_PARTS.map((key) => `${PART_META[key].short} ${money(values[key], perLitre)}`).join(', ');

  const known = $derived(page.hiddenCharges.filter((c) => c.eurPerLitre !== null));
  const hiddenTotal = $derived(known.reduce((s, c) => s + (c.eurPerLitre ?? 0), 0) * k);
  const imposed = $derived(taxes + hiddenTotal);

  const maxTotal = $derived(Math.max(total, total08));
  const quarterLabel = (y: number, q: number) => `${q}${q === 1 ? 'er' : 'e'} trimestre ${y}`;
  const firstYear = $derived(p.quarterly[0]?.year ?? 2005);
  const years = $derived([2005, 2010, 2015, 2020, 2025].filter((y) => y >= firstYear)
    .map((y) => ({ index: p.quarterly.findIndex((q) => q.year === y), label: String(y) })).filter((t) => t.index >= 0));
  const lastYear = $derived(p.annual.at(-1)?.year ?? 2026);
  const refYear = $derived(Number(page.referenceLabel.match(/\d{4}/)?.[0] ?? 2008));

  const faq = $derived([
    { q: 'Prix du baril : pourquoi il ne fait pas le prix à la pompe ?',
      a: `Un baril contient 159 litres de pétrole brut. Converti en euros, il revient cette semaine à ${eur2(p.now.oil)} par litre, sur ${eur2(p.litre)} payés à la pompe pour le ${name}. Le reste : raffinage, transport, distribution et taxes.` },
    { q: 'Combien de taxes sur un litre de carburant ?',
      a: `Cette semaine, ${eur2(p.now.excise + p.now.vat)} par litre de ${name} : ${eur2(p.now.excise)} de TICPE et ${eur2(p.now.vat)} de TVA, soit ${percent(p.now.excise + p.now.vat, p.litre)} du prix. En comptant les charges imposées mais cachées, comme les certificats d'économies d'énergie, on dépasse ${percent((p.now.excise + p.now.vat) + known.reduce((s, c) => s + (c.eurPerLitre ?? 0), 0), p.litre)}.` },
    { q: `Pourquoi le carburant est-il plus cher qu'en ${refYear} ?`,
      a: `En ${page.referenceLabel.toLowerCase()}, le baril valait ${Math.round(page.market.brentUsd.reference)} dollars et un euro ${page.market.usdPerEur.reference.toFixed(2).replace('.', ',')} dollar. Aujourd'hui : ${Math.round(page.market.brentUsd.now)} dollars, et un euro ne vaut plus que ${page.market.usdPerEur.now.toFixed(2).replace('.', ',')} dollar. Ramené au litre, le pétrole coûte presque pareil. La hausse vient surtout du raffinage et de la distribution, puis des taxes.` },
    { q: 'Le carburant va-t-il baisser ?',
      a: "Le prix à la pompe suit celui du pétrole avec quelques jours de retard. Winnza publiera une tendance de la semaine à venir, seulement une fois qu'elle aura fait ses preuves sur les années passées." },
  ]);
</script>

<Seo site={data.site} page={{
  path: '/',
  title: `Prix du carburant : où passe l'argent de votre plein ? | Winnza`,
  description: `Sur ${eur2(page.products[0]!.litre)} de ${page.products[0]!.label.toLowerCase()}, combien pour le pétrole, la raffinerie, la TICPE, la TVA et les taxes cachées ? Le vrai découpage du prix à la pompe, chaque semaine, chiffres officiels.`,
  faq, modified: page.asOf }} />

<main class="wrap">
  <section class="hero" aria-labelledby="titre">
    <div class="hero-grid">
      <div class="hero-text">
        <p class="chip"><Icon name={ICON.chart} size={16} />Prix officiels, mis à jour chaque semaine</p>
        <h1 id="titre">Où passe l'argent de votre plein&#160;?</h1>
        <p class="intro">Sur chaque litre, une partie paie le pétrole, une autre la raffinerie et la station, le reste part en taxes. Voici combien, cette semaine.</p>
        <div class="controls">
          <Toggle label="Carburant" bind:value={productId} options={page.products.map((x) => ({ id: x.id, label: x.label }))} />
          <Toggle label="Afficher" bind:value={unit} options={[{ id: UNIT.litre, label: '1 litre' }, { id: UNIT.fill, label: 'Mon plein' }]} />
        </div>
        {#if !perLitre}
          <div class="slider">
            <label for="litres"><span>Mon plein</span><span>{litres} litres</span></label>
            <input id="litres" type="range" min="20" max="80" step="5" bind:value={litres} />
          </div>
        {/if}
        <div class="headline">
          <span class="big">{money(total, perLitre)}</span>
          <span class="sub">{perLitre ? `le litre de ${name}, moyenne nationale de la semaine du ${longDate(page.asOf)}` : `pour ${litres} litres de ${name}, à ${eur2(p.litre)} le litre`}</span>
        </div>
      </div>
      <Jerrycan values={now} texts={allText(now)} label={describe(now, perLitre ? `Un litre à ${money(total, true)}` : `Votre plein de ${money(total, false)}`)} />
    </div>

    <div class="bar-wrap"><StackedBar values={now} texts={shareText(now, total)} label={describe(now, 'Répartition')} /></div>

    <div class="grid-cards parts">
      {#each LITRE_PARTS as key (key)}<PartCard part={key} value={money(now[key], perLitre)} share={percent(now[key], total)} />{/each}
    </div>
    <p class="punch">Au total, {money(taxes, perLitre)} de taxes affichées, soit {percent(taxes, total)} de ce que vous payez. Le pétrole, lui, ne pèse que {percent(now.oil, total)}.</p>
  </section>

  <section class="section" aria-labelledby="cachees">
    <h2 class="h2" id="cachees">Et les taxes qu'on ne voit pas</h2>
    <p class="lead">Une partie de « la raffinerie et la station » n'est pas une marge : ce sont des obligations imposées par l'État aux vendeurs de carburant, qui les répercutent dans le prix. Elles n'apparaissent nulle part sur le ticket.</p>
    <div class="card pad">
      <div class="headline">
        <span class="mid">{money(imposed, perLitre)}</span>
        <span class="sub">sur {money(total, perLitre)} sont imposés par l'État, soit {percent(imposed, total)}, en comptant les charges cachées</span>
      </div>
      <div class="thin" role="img" aria-label="{percent(imposed, total)} du prix est imposé par l'État">
        <span style:flex-grow={imposed} style:background="var(--s3)"></span><span style:flex-grow={total - imposed} style:background="var(--line)"></span>
      </div>
      <div class="thin-legend"><span>Imposé par l'État</span><span>Pétrole, raffinage, transport, stations</span></div>
      <ul class="charges">
        <li><span class="tag shown">Affichée</span><span class="what"><strong>TICPE (accise sur les énergies)</strong><span>Montant fixe par litre, voté chaque année.</span></span><span class="amount">{money(now.excise, perLitre)}</span></li>
        <li><span class="tag shown">Affichée</span><span class="what"><strong>TVA</strong><span>{Math.round(vatRate * 100)}{NBSP_PERCENT} sur tout le reste, y compris sur la TICPE et sur les charges cachées ci-dessous.</span></span><span class="amount">{money(now.vat, perLitre)}</span></li>
        {#each page.hiddenCharges as c (c.id)}
          <li>
            <span class="tag hidden">Cachée</span>
            <span class="what"><strong>{c.label}</strong><span>{c.description} <a href={c.source.url}>{c.source.name}</a>{c.asOf ? `, relevé du ${longDate(c.asOf)}` : ''}.</span></span>
            <span class="amount">{c.eurPerLitre === null ? 'non publié' : money(c.eurPerLitre * k, perLitre)}</span>
          </li>
        {/each}
      </ul>
      <p class="caption">Montants estimés : les vendeurs ne publient pas le coût exact qu'ils répercutent. Ils sont déjà compris dans « la raffinerie et la station », pas ajoutés en plus.</p>
    </div>
  </section>

  <section class="section" aria-labelledby="annees">
    <h2 class="h2" id="annees">Ce que contient un litre de {name}, année par année</h2>
    <p class="lead">La TICPE a peu bougé depuis 2018. Ce qui grossit, cette année, c'est la part de la raffinerie et de la station.</p>
    <figure class="card pad fig">
      <ColumnsChart rows={p.annual} highlight={[refYear, lastYear]} label="Décomposition du prix d'un litre de {name} par année depuis {p.annual[0]?.year}, en quatre parts : pétrole, raffinerie et station, TICPE, TVA." />
      <figcaption class="caption">Moyenne de chaque année, en euros par litre, France. {lastYear} : jusqu'au {longDate(page.asOf)}. Survolez une colonne pour le détail.</figcaption>
    </figure>
  </section>

  <section class="section" aria-labelledby="avant">
    <h2 class="h2" id="avant">En {refYear}, le baril battait son record. {perLitre ? 'Le litre' : 'Le même plein'} coûtait {money(total08, perLitre)}.</h2>
    <p class="lead">{perLitre ? `Le litre de ${name}` : `Le même plein de ${litres} litres`} coûte aujourd'hui {money(total, perLitre)}, soit {money(total - total08, perLitre)} de plus. Le pétrole n'en explique que {money(now.oil - ref.oil, perLitre)}.</p>
    <div class="card pad">
      <div class="compare">
        {#each [{ title: page.referenceLabel, values: ref, tot: total08 }, { title: 'Cette semaine', values: now, tot: total }] as row (row.title)}
          <div class="row">
            <span class="row-title">{row.title}</span>
            <div class="row-bar">
              <StackedBar values={row.values} texts={fitText(row.values, row.tot, row.tot / maxTotal)} scale={row.tot / maxTotal} label={describe(row.values, row.title)} />
              <span class="row-total">{money(row.tot, perLitre)}</span>
            </div>
          </div>
        {/each}
      </div>
      <div class="deltas">
        {#each LITRE_PARTS as key (key)}
          <div class="delta"><div class="d-label"><span class="d-dot" style:background={PART_META[key].color}></span>{PART_META[key].label}</div><div class="d-value">{signed(now[key] - ref[key], perLitre)}</div><div class="d-since">depuis {page.referenceLabel.toLowerCase()}</div></div>
        {/each}
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="baril">
    <h2 class="h2" id="baril">Le prix du baril ne fait pas le prix à la pompe</h2>
    <p class="lead">Le pétrole, ramené au litre, coûte à peu près ce qu'il coûtait en {refYear}. L'écart avec ce que vous payez, lui, s'est creusé.</p>
    <figure class="card pad fig">
      <LineChart labels={p.quarterly.map((q) => quarterLabel(q.year, q.quarter))} {years}
        series={[{ key: 'pump', label: `Prix à la pompe (${name})`, color: 'var(--ink)', values: p.quarterly.map((q) => q.pump) },
                 { key: 'oil', label: 'Pétrole brut, ramené au litre', color: 'var(--s1)', values: p.quarterly.map((q) => q.oil) }]}
        label="Prix du {name} à la pompe et prix du pétrole brut au litre, par trimestre depuis {firstYear}. Flèches gauche et droite pour parcourir." />
      <figcaption class="caption">En euros par litre, moyennes par trimestre. Survolez la courbe, ou utilisez les flèches du clavier.</figcaption>
    </figure>
  </section>

  <section class="section" aria-labelledby="voisins">
    <h2 class="h2" id="voisins">Moins cher chez nos voisins&#160;?</h2>
    <p class="lead">{perLitre ? `Le prix moyen d'un litre de ${name} cette semaine, pays par pays.` : `Le même plein de ${litres} litres, au prix moyen de chaque pays cette semaine.`}</p>
    <div class="grid-cards neighbours">
      {#each p.neighbours as n (n.code)}
        {@const diff = (n.litre - p.litre) * k}
        <div class="card country" class:cheaper={diff < 0}>
          <div class="c-head"><span class="flag" style:background={FLAG[n.code] ?? 'var(--soft)'} aria-hidden="true"></span>{n.label}</div>
          <div class="c-value">{money(n.litre * k, perLitre)}</div>
          <div class="c-sub">{perLitre ? `le litre de ${name}` : `${eur2(n.litre)} le litre`}</div>
          <div class="c-diff">{diff < 0 ? `${money(-diff, perLitre)} de moins` : `${money(diff, perLitre)} de plus`} qu'en France</div>
        </div>
      {/each}
    </div>
  </section>

  <section class="section" id="comprendre" aria-labelledby="comprendre-titre">
    <div class="split">
      <h2 class="h2" id="comprendre-titre">Comprendre en une minute</h2>
      <span class="ai-note"><Icon name={ICON.spark} size={14} />Explications tenues à jour par l'IA de Winnza</span>
    </div>
    <div class="grid-cards explain">
      <article class="card x"><div class="badge wide" style:background="var(--s3)" style:color="var(--on-s3)">TICPE</div><h3>La TICPE, c'est quoi&#160;?</h3><p>La taxe intérieure de consommation sur les produits énergétiques. Un montant fixe par litre, voté chaque année : {eur2(p.now.excise)} pour le {name}. Elle ne baisse pas quand le pétrole baisse.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s4)" style:color="var(--on-s4)">{Math.round(vatRate * 100)}{NBSP_PERCENT}</div><h3>Une taxe sur une taxe</h3><p>La TVA s'applique au prix hors taxes, mais aussi à la TICPE. Sur un litre de {name}, cela fait environ {eur2(p.now.excise * vatRate)} de TVA payés sur la seule TICPE.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s1)" style:color="var(--on-s1)">$</div><h3>Pourquoi le dollar compte</h3><p>Le pétrole s'achète en dollars. Quand l'euro baisse, le même baril coûte plus cher en euros. En {page.referenceLabel.toLowerCase()}, un euro valait {page.market.usdPerEur.reference.toFixed(2).replace('.', ',')} dollar ; aujourd'hui, {page.market.usdPerEur.now.toFixed(2).replace('.', ',')}.</p></article>
      <article class="card x"><div class="badge" style:background="var(--s2)" style:color="var(--on-s2)">?</div><h3>Qui fixe le prix à la pompe&#160;?</h3><p>Personne en particulier : en France, chaque station fixe son prix. Mais toutes achètent leur carburant aux mêmes cours, d'où des prix proches d'une station à l'autre.</p></article>
    </div>
  </section>

  <section class="section" aria-labelledby="questions">
    <h2 class="h2" id="questions">Vos questions</h2>
    <div class="faq">
      {#each faq as f (f.q)}
        <details class="card"><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>
      {/each}
    </div>
  </section>
</main>

<style>
  .hero { padding: 44px 0 8px; }
  .hero-grid { display: flex; flex-wrap: wrap; gap: 32px 48px; align-items: center; }
  .hero-text { flex: 1 1 520px; min-width: 0; }
  .chip { margin: 0 0 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--ink2); background: var(--card); border-radius: 999px; padding: 6px 12px; box-shadow: var(--shadow); }
  h1 { margin: 0; font-weight: 800; font-size: clamp(34px, 5.2vw, 62px); line-height: 1.04; letter-spacing: -2px; }
  .intro { margin: 16px 0 0; font-size: clamp(17px, 2vw, 20px); line-height: 1.5; color: var(--ink2); max-width: 600px; }
  .controls { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
  .slider { max-width: 420px; margin-top: 18px; }
  .slider label { display: flex; justify-content: space-between; font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .slider input { accent-color: #2a78d6; width: 100%; height: 28px; }
  .headline { margin-top: 22px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
  .big { font-size: clamp(56px, 8vw, 92px); font-weight: 800; letter-spacing: -3px; line-height: 1; }
  .mid { font-size: clamp(44px, 6vw, 64px); font-weight: 800; letter-spacing: -2px; line-height: 1; }
  .sub { font-size: 16px; color: var(--muted); line-height: 1.4; }
  .bar-wrap { margin-top: 32px; }
  .parts { margin-top: 18px; }
  .punch { margin: 16px 0 0; font-size: 17px; line-height: 1.5; font-weight: 600; }
  .pad { padding: clamp(20px, 3vw, 32px); margin-top: 24px; }
  .fig { margin: 24px 0 0; padding: clamp(16px, 2.6vw, 28px); }
  .thin { display: flex; gap: 2px; height: 12px; margin-top: 18px; }
  .thin span { border-radius: 999px; }
  .thin-legend { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); margin-top: 6px; gap: 12px; }
  .charges { list-style: none; margin: 24px 0 0; padding: 0; }
  .charges li { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 16px; padding: 16px 0; border-top: 1px solid var(--line); }
  .tag { flex: 0 0 auto; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-top: 2px; }
  .tag.shown { background: var(--soft); color: var(--ink2); }
  .tag.hidden { background: var(--ink); color: var(--card); }
  .what { flex: 1 1 380px; min-width: 0; }
  .what strong { display: block; font-size: 16px; }
  .what span { display: block; font-size: 14px; line-height: 1.55; color: var(--ink2); margin-top: 2px; }
  .amount { font-size: 20px; font-weight: 800; white-space: nowrap; }
  .compare { display: flex; flex-direction: column; gap: 18px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .row-title { flex: 0 0 140px; font-size: 15px; font-weight: 700; }
  .row-bar { flex: 1 1 360px; min-width: 0; display: flex; align-items: center; gap: 12px; }
  .row-total { font-size: 18px; font-weight: 800; white-space: nowrap; }
  .deltas { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 24px; }
  .delta { border-radius: 16px; padding: 16px 18px; background: var(--soft); }
  .d-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink2); }
  .d-dot { width: 10px; height: 10px; border-radius: 3px; }
  .d-value { font-size: 26px; font-weight: 800; margin-top: 6px; }
  .d-since { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .neighbours, .explain { margin-top: 24px; }
  .country { padding: 18px 20px; border-radius: 20px; }
  .country.cheaper { outline: 2px solid var(--s3); outline-offset: -2px; }
  .c-head { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; }
  .flag { width: 26px; height: 18px; border-radius: 4px; box-shadow: 0 0 0 1px var(--line); }
  .c-value { font-size: 30px; font-weight: 800; letter-spacing: -0.8px; margin-top: 10px; }
  .c-sub { font-size: 14px; color: var(--ink2); margin-top: 2px; }
  .c-diff { display: inline-block; margin-top: 12px; font-size: 14px; font-weight: 700; padding: 6px 10px; border-radius: 999px; background: var(--soft); }
  .split { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
  .ai-note { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  .x { padding: 22px; border-radius: 22px; }
  .badge { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; }
  .badge.wide { width: auto; display: inline-flex; padding: 0 14px; font-size: 16px; }
  .x h3 { margin: 16px 0 8px; font-size: 19px; font-weight: 800; line-height: 1.25; }
  .x p { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink2); }
  .faq { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
  details { border-radius: 18px; padding: 0 22px; }
  summary { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 64px; font-size: 18px; font-weight: 700; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary span { font-size: 24px; color: var(--muted); }
  details p { margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: var(--ink2); }
</style>
