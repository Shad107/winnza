<script lang="ts">
  // Carte zoomable des stations : fond OpenStreetMap servi par Winnza (aucun tiers), une pastille par
  // station colorée par son prix (cinq classes de même effectif) ou par sa variation sur 7 jours.
  // MapLibre n'est chargé que dans le navigateur, et seulement sur cette page.
  import { onMount } from 'svelte';
  import type { Map as MapLibreMap, ExpressionSpecification } from 'maplibre-gl';
  import { STATION_PROP, type StationsMap } from '@winnza/core/pages/stations-map.js';
  import { MAP_MODE, type MapMode } from '#lib/map-mode.ts';
  import { eur2, longDate } from '#lib/format.ts';

  let { fuelId, mode, onloaded, onlegend, onlocated, onlocateerror, zoomTo, highlight }: {
    fuelId: string;
    mode: MapMode;
    onloaded: (m: NonNullable<StationsMap>) => void;
    /** position du visiteur, s'il a accepté d'être localisé (elle ne quitte pas son navigateur) */
    onlocated: (lon: number, lat: number) => void;
    /** position refusée par le visiteur ou introuvable */
    onlocateerror: () => void;
    onlegend: (l: { color: string; text: string }[]) => void;
    /** demande de recentrage (code postal), ou null */
    zoomTo: [number, number, number, number] | null;
    /** station entourée (la moins chère autour du visiteur, ou celle qu'il a choisie dans la liste) */
    highlight: string | null;
  } = $props();

  let el: HTMLDivElement;
  let map: MapLibreMap | null = null;
  let data: NonNullable<StationsMap> | null = null;
  let ready = $state(false);
  let geolocate: { trigger: () => boolean } | null = null;
  let failed = $state(false);

  /** Rampe bleue validée (clair) et la même en sombre ; divergente bleu (baisse) / rouge (hausse), gris neutre. */
  const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const CHANGE_STEPS = [-0.02, -0.005, 0.005, 0.02] as const;

  function quintiles(values: number[]): number[] {
    const v = [...values].sort((a, b) => a - b);
    return [1, 2, 3, 4].map((i) => v[Math.min(v.length - 1, Math.floor((v.length * i) / 5))] ?? 0);
  }

  /** « 2,15 € » : prix affiché sous la pastille au zoom de la rue */
  const priceText = (prop: string): ExpressionSpecification =>
    ['concat', ['number-format', ['get', prop], { locale: 'fr-FR', 'min-fraction-digits': 2, 'max-fraction-digits': 2 }], ' €'];

  function paint() {
    if (!map || !data || !map.getLayer('stations')) return;
    const price = STATION_PROP.price + fuelId, change = STATION_PROP.change + fuelId, stale = STATION_PROP.stale + fuelId;
    const ramp = ['--q1', '--q2', '--q3', '--q4', '--q5'].map(css);
    const neutral = css('--muted');
    if (mode === MAP_MODE.price) {
      const fresh = data.features.flatMap((f) => (typeof f.properties[price] === 'number' && !f.properties[stale] ? [f.properties[price] as number] : []));
      const b = quintiles(fresh);
      const color: ExpressionSpecification = ['case', ['has', stale], neutral,
        ['step', ['get', price], ramp[0]!, b[0]!, ramp[1]!, b[1]!, ramp[2]!, b[2]!, ramp[3]!, b[3]!, ramp[4]!]];
      map.setFilter('stations', ['has', price]);
      map.setPaintProperty('stations', 'circle-color', color);
      map.setFilter('stations-label', ['has', price]);
      map.setLayoutProperty('stations-label', 'text-field', priceText(price));
      const lo = Math.min(...fresh), hi = Math.max(...fresh);
      const edges = [lo, ...b, hi];
      onlegend([...ramp.map((c, i) => ({ color: c, text: `${eur2(edges[i]!)} à ${eur2(edges[i + 1]!)}` })),
        { color: neutral, text: `prix non mis à jour depuis plus de ${data.maxAgeDays} jours` }]);
    } else {
      const down = css('--down-strong'), downSoft = css('--down'), up = css('--up'), upStrong = css('--up-strong');
      map.setFilter('stations', ['has', change]);
      map.setFilter('stations-label', ['has', change]);
      map.setLayoutProperty('stations-label', 'text-field', ['concat', ['case', ['>', ['get', change], 0], '+', ''],
        ['number-format', ['*', ['get', change], 100], { locale: 'fr-FR', 'max-fraction-digits': 0 }], ' ct']);
      map.setPaintProperty('stations', 'circle-color',
        ['step', ['get', change], down, CHANGE_STEPS[0], downSoft, CHANGE_STEPS[1], neutral, CHANGE_STEPS[2], up, CHANGE_STEPS[3], upStrong]);
      onlegend([{ color: down, text: 'baisse de plus de 2 ct' }, { color: downSoft, text: 'baisse' }, { color: neutral, text: 'stable (moins d\'un demi-centime)' },
        { color: up, text: 'hausse' }, { color: upStrong, text: 'hausse de plus de 2 ct' }]);
    }
  }

  $effect(() => { void fuelId; void mode; if (ready) paint(); });
  $effect(() => { const k = highlight ?? ''; if (ready && map) map.setFilter('stations-highlight', ['==', ['get', 'k'], k]); });
  $effect(() => { if (zoomTo && map) map.fitBounds([[zoomTo[0], zoomTo[1]], [zoomTo[2], zoomTo[3]]], { padding: 60, maxZoom: 14 }); });

  /** Fiche d'une station : construite nœud par nœud (les adresses viennent d'une source externe). */
  function card(p: Record<string, unknown>): HTMLElement {
    const root = document.createElement('div');
    root.className = 'st-card';
    const line = (tag: string, text: string, cls = '') => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; root.append(e); return e; };
    // nom ou enseigne (OpenStreetMap) quand on l'a, puis l'adresse du flux officiel
    if (p.n) { line('strong', String(p.n)); line('div', String(p.a || ''), 'st-muted'); }
    else line('strong', String(p.a || 'Adresse non renseignée'));
    line('div', `${String(p.cp ?? '')} ${String(p.c ?? '')}${p.h ? ' · automate 24 h/24' : ''}`, 'st-muted');
    const table = document.createElement('table');
    for (const f of data!.fuels) {
      const price = p[STATION_PROP.price + f.id];
      if (typeof price !== 'number') continue;
      const tr = table.insertRow();
      tr.insertCell().textContent = f.label;
      const td = tr.insertCell(); td.textContent = eur2(price); td.className = 'st-num';
      const d = p[STATION_PROP.change + f.id];
      const td2 = tr.insertCell(); td2.className = 'st-muted';
      td2.textContent = p[STATION_PROP.stale + f.id] ? 'prix ancien'
        : typeof d === 'number' ? (Math.abs(d) < 0.005 ? 'stable en 7 j' : `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) * 100)} ct en 7 j`) : '';
      if (f.id === fuelId) tr.className = 'st-current';
    }
    root.append(table);
    line('div', `Prix affichés par la station, relevés le ${longDate(data!.date)}.`, 'st-muted');
    return root;
  }

  onMount(() => {
    let cancelled = false;
    (async () => {
      try {
        const [maplibregl, { Protocol }, { layers, namedFlavor }, { default: workerUrl }] = await Promise.all([
          import('maplibre-gl'), import('pmtiles'), import('@protomaps/basemaps'),
          // le décodeur de la carte tourne dans un worker : fichier publié tel quel par Vite, servi par Winnza
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
        ]);
        maplibregl.setWorkerUrl(workerUrl);
        await import('maplibre-gl/dist/maplibre-gl.css');
        const protocol = new Protocol();
        maplibregl.addProtocol('pmtiles', protocol.tile);
        const dark = document.documentElement.dataset.theme === 'dark'
          || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        const flavor = dark ? 'dark' : 'light';
        const origin = location.origin;
        const m = new maplibregl.Map({
          container: el,
          style: {
            version: 8,
            glyphs: `${origin}/carte/fonts/{fontstack}/{range}.pbf`,
            sprite: `${origin}/carte/sprites/${flavor}`,
            sources: { protomaps: { type: 'vector', url: `pmtiles://${origin}/carte/france.pmtiles`,
              attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>, <a href="https://protomaps.com">Protomaps</a>' } },
            layers: layers('protomaps', namedFlavor(flavor), { lang: 'fr' }),
          },
          bounds: [[-5.2, 41.3], [9.6, 51.1]],
          maxBounds: [[-12, 38], [16, 54]],
          minZoom: 4, maxZoom: 17,
          attributionControl: { compact: true },
        });
        map = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, fitBoundsOptions: { maxZoom: 13 } });
        geo.on('geolocate', (e) => onlocated(e.coords.longitude, e.coords.latitude));
        geo.on('error', () => onlocateerror());
        m.addControl(geo, 'top-right');
        geolocate = geo;
        const res = await fetch('/carte-des-stations/stations.json');
        if (!res.ok) throw new Error(`stations : ${res.status}`);
        data = (await res.json()) as NonNullable<StationsMap>;
        if (cancelled) return;
        onloaded(data);
        m.on('load', () => {
          if (!map || !data) return;
          map.addSource('stations', { type: 'geojson', data });
          map.addLayer({ id: 'stations', type: 'circle', source: 'stations', paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 8, 3.5, 11, 6, 14, 9],
            'circle-stroke-color': css('--card'), 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 10, 1.2],
          } });
          // l'anneau autour de la station mise en avant
          map.addLayer({ id: 'stations-highlight', type: 'circle', source: 'stations', filter: ['==', ['get', 'k'], ''], paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 11, 11, 14, 15], 'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': css('--ink'), 'circle-stroke-width': 3 } });
          // le prix écrit sous chaque pastille, quand on est assez près pour lire la rue
          map.addLayer({ id: 'stations-label', type: 'symbol', source: 'stations', minzoom: 11, layout: {
            'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
          }, paint: { 'text-color': css('--ink'), 'text-halo-color': css('--card'), 'text-halo-width': 1.6 } });
          map.on('click', 'stations', (e) => {
            const f = e.features?.[0];
            if (!f || f.geometry.type !== 'Point') return;
            new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(card(f.properties)).addTo(map!);
          });
          map.on('mouseenter', 'stations', () => { map!.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', 'stations', () => { map!.getCanvas().style.cursor = ''; });
          ready = true;
          paint();
        });
      } catch (e) {
        console.error(e);
        failed = true;
      }
    })();
    return () => { cancelled = true; map?.remove(); };
  });

  /** « Autour de moi » : demande la position au navigateur (qui demande l'accord du visiteur) */
  export function locate(): boolean { return geolocate?.trigger() ?? false; }

  /** pour la recherche par code postal : l'emprise des stations d'un code */
  export function boundsOfPostcode(cp: string): [number, number, number, number] | null {
    const pts = data?.features.filter((f) => f.properties.cp === cp).map((f) => f.geometry.coordinates) ?? [];
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs) - 0.02, Math.min(...ys) - 0.02, Math.max(...xs) + 0.02, Math.max(...ys) + 0.02];
  }
</script>

<div class="frame">
  <div class="map" bind:this={el} role="region" aria-label="Carte des stations-service et de leurs prix"></div>
  {#if failed}<p class="state">La carte n'a pas pu se charger. Les prix par département restent disponibles.</p>
  {:else if !ready}<p class="state">Chargement de la carte et des 9 500 stations…</p>{/if}
</div>

<style>
  .frame { position: relative; border-radius: 20px; overflow: hidden; background: var(--soft); }
  .map { width: 100%; height: min(72vh, 680px); min-height: 420px; }
  .state { position: absolute; inset: auto 0 0 0; margin: 0; padding: 12px 16px; background: var(--card); color: var(--ink2); font-size: 14px; }
  :global(.st-card) { font: 14px/1.45 'Inter Variable', system-ui, sans-serif; color: #111418; }
  :global(.st-card table) { border-collapse: collapse; margin: 8px 0; width: 100%; }
  :global(.st-card td) { padding: 3px 6px 3px 0; border-top: 1px solid #e3e6eb; }
  :global(.st-card .st-num) { font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(.st-card .st-muted) { color: #5f6670; font-size: 13px; }
  :global(.st-card .st-current td) { background: #eef1f5; }
</style>
