<script lang="ts">
  // Prix du jour de chaque carburant, moyenne des stations de France (plugin stations).
  import type { StationsToday } from '@winnza/core/pages/fuel-page.js';
  import { eur2, eur0, longDate } from '#lib/format.ts';
  let { stations, litres }: { stations: NonNullable<StationsToday>; litres: number } = $props();
  const fmt = new Intl.NumberFormat('fr-FR');
  const cheapest = $derived(Math.min(...stations.fuels.map((f) => f.avg)));
</script>

<section class="section" aria-labelledby="jour">
  <h2 class="h2" id="jour">Le prix de chaque carburant aujourd'hui</h2>
  <p class="lead">Moyenne des stations de France le {longDate(stations.date)}, à partir des prix affichés et mis à jour dans la semaine.</p>
  <div class="grid-cards fuels">
    {#each stations.fuels as f (f.id)}
      <div class="card fuel" class:best={f.avg === cheapest}>
        <div class="name">{f.label}</div>
        <div class="price">{eur2(f.avg)}<span> le litre</span></div>
        <div class="fill">{eur0(f.avg * litres)} le plein de {litres} litres</div>
        <div class="count">{fmt.format(f.stations)} stations</div>
      </div>
    {/each}
  </div>
  <p class="caption">Source : flux officiel des prix des carburants (ministère de l'Économie). Le superéthanol E85 et le GPL sont moins chers au litre, mais un moteur en consomme davantage : le vrai calcul est celui du coût aux 100 km, bientôt sur Winnza. <a href="/prix-par-departement">Le prix dans votre département</a>.</p>
</section>

<style>
  .fuels { margin-top: 24px; }
  .fuel { padding: 18px 20px; border-radius: 20px; }
  .fuel.best { outline: 2px solid var(--s3); outline-offset: -2px; }
  .name { font-size: 16px; font-weight: 700; }
  .price { font-size: 32px; font-weight: 800; letter-spacing: -0.8px; margin-top: 8px; }
  .price span { font-size: 14px; font-weight: 600; color: var(--muted); letter-spacing: 0; margin-left: 6px; }
  .fill { font-size: 14px; color: var(--ink2); margin-top: 4px; }
  .count { display: inline-block; margin-top: 12px; font-size: 13px; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: var(--soft); color: var(--ink2); }
</style>
