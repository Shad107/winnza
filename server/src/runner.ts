// Une collecte : greffons -> téléchargements -> base -> dérivations -> ancres. Tout ce qui touche la base
// se fait dans UNE transaction : si une ancre ne colle pas, rien n'est écrit et la collecte échoue.
import type { CollectContext, Collector, Derivation, Observation, Plugin, SeriesDecl, SourceDecl } from "./contract.js";
import { checkAnchors, type Anchor, type AnchorResult } from "./anchors.js";
import type { Store } from "./store.js";

export type Registry = {
  sources: Map<string, SourceDecl>;
  series: Map<string, SeriesDecl>;
  collectors: Collector[];
  derivations: Derivation[];
};

export function buildRegistry(plugins: readonly Plugin[]): Registry {
  const reg: Registry = { sources: new Map(), series: new Map(), collectors: [], derivations: [] };
  for (const p of plugins) {
    p.register({
      declareSource: (s) => {
        if (reg.sources.has(s.id)) throw new Error(`source déclarée deux fois : ${s.id}`);
        reg.sources.set(s.id, s);
      },
      declareSeries: (s) => {
        if (reg.series.has(s.id)) throw new Error(`série déclarée deux fois : ${s.id}`);
        reg.series.set(s.id, s);
      },
      registerCollector: (c) => reg.collectors.push(c),
      registerDerivation: (d) => reg.derivations.push(d),
    });
  }
  for (const s of reg.series.values()) {
    if (!reg.sources.has(s.sourceId)) throw new Error(`série ${s.id} : source inconnue ${s.sourceId}`);
    for (const d of s.derivedFrom ?? []) if (!reg.series.has(d)) throw new Error(`série ${s.id} : dérivée d'une série inconnue ${d}`);
  }
  return reg;
}

/** Une observation d'une série non déclarée est une faute de frappe, pas une donnée : on refuse. */
function assertDeclared(reg: Registry, obs: readonly Observation[], who: string): void {
  for (const o of obs) {
    if (!reg.series.has(o.seriesId)) throw new Error(`${who} : série non déclarée ${o.seriesId}`);
    if (!Number.isFinite(o.value)) throw new Error(`${who} : valeur non finie pour ${o.seriesId} au ${o.date}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) throw new Error(`${who} : date invalide ${o.date}`);
  }
}

export type RunReport = { observations: number; anchors: AnchorResult[] };

export async function runCollect(store: Store, plugins: readonly Plugin[], ctx: CollectContext, anchors: readonly Anchor[]): Promise<RunReport> {
  const reg = buildRegistry(plugins);
  const batches: Observation[][] = [];
  for (const c of reg.collectors) {
    const obs = await c.run(ctx);
    assertDeclared(reg, obs, `collecteur ${c.id}`);
    if (!obs.length) throw new Error(`collecteur ${c.id} : aucune donnée (source changée ?)`);
    batches.push(obs);   // pas de push(...obs) : des centaines de milliers d'arguments font déborder la pile
  }
  const collected = batches.flat();
  for (const a of anchors) if (!reg.series.has(a.seriesId)) throw new Error(`ancre sur une série inconnue : ${a.seriesId}`);

  let total = collected.length;
  let results: AnchorResult[] = [];
  store.db.transaction(() => {
    for (const s of reg.sources.values()) store.upsertSource(s);
    for (const s of reg.series.values()) store.upsertSeries(s);
    store.putObservations(collected);
    for (const d of reg.derivations) {
      const obs = d.run(store);
      assertDeclared(reg, obs, `dérivation ${d.id}`);
      store.putObservations(obs);
      total += obs.length;
    }
    results = checkAnchors(store, anchors);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      throw new Error("ancres non respectées, rien n'est écrit :\n" + failed.map((r) =>
        `  ${r.anchor.seriesId} [${r.anchor.from}..${r.anchor.to}] ${r.anchor.aggregate} : attendu ${r.anchor.expected} ±${r.anchor.tolerance} (${r.anchor.publishedBy}), obtenu ${r.actual ?? "aucune donnée"}`).join("\n"));
    }
  })();
  return { observations: total, anchors: results };
}
