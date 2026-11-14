// Une collecte : plugins -> téléchargements -> base -> dérivations -> ancres. Tout ce qui touche la base
// se fait dans UNE transaction : si une ancre ne colle pas, rien n'est écrit et la collecte échoue.
//
// Les plugins sont chargés par OpenPluginHost : un plugin en échec est écarté et signalé, il ne bloque
// pas les autres. Ses déclarations ne sont retenues QUE si son chargement a réussi en entier.
import { createPluginHost } from "@isno-open/plugin-host";
import { PLUGIN_CATEGORIES, PLUGIN_CATEGORY, type CollectContext, type Collector, type Derivation, type Observation, type Plugin, type PluginApi, type SeriesDecl, type SettingDecl, type Snapshot, type SnapshotCollector, type SnapshotDecl, type SourceDecl } from "./contract.js";
import { checkAnchors, type Anchor, type AnchorResult } from "./anchors.js";
import type { Store } from "./store.js";

export type Registry = {
  sources: Map<string, SourceDecl>;
  series: Map<string, SeriesDecl>;
  collectors: Collector[];
  derivations: Derivation[];
  settings: Map<string, SettingDecl>;
  snapshots: Map<string, SnapshotDecl>;
  snapshotCollectors: SnapshotCollector[];
  /** plugin qui a déclaré chaque réglage */
  settingOwner: Map<string, string>;
  loaded: string[];
  failed: { id: string; error: string }[];
};

type Staged = { sources: SourceDecl[]; series: SeriesDecl[]; collectors: Collector[]; derivations: Derivation[]; settings: SettingDecl[]; snapshots: SnapshotDecl[]; snapshotCollectors: SnapshotCollector[] };

/** Charge les plugins actifs et rassemble leurs déclarations. `settingsOf` : les réglages d'un plugin. */
export async function buildRegistry(builtins: Readonly<Record<string, Plugin>>, enabled: readonly string[],
  settingsOf: (id: string) => unknown, log?: (m: string) => void): Promise<Registry> {
  const staged = new Map<string, Staged>();
  const host = createPluginHost<PluginApi, (typeof PLUGIN_CATEGORIES)[number]>({
    builtins, categories: PLUGIN_CATEGORIES, defaultCategory: PLUGIN_CATEGORY.other,
    storedSettings: settingsOf, ...(log ? { log } : {}),
    // chaque plugin écrit dans SON brouillon ; on ne verse au registre que ceux qui ont réussi
    makeApi: ({ id }) => {
      const s: Staged = { sources: [], series: [], collectors: [], derivations: [], settings: [], snapshots: [], snapshotCollectors: [] };
      staged.set(id, s);
      return {
        declareSource: (x) => { s.sources.push(x); },
        declareSeries: (x) => { s.series.push(x); },
        declareSetting: (x) => { s.settings.push(x); },
        registerCollector: (x) => { s.collectors.push(x); },
        registerDerivation: (x) => { s.derivations.push(x); },
        declareSnapshot: (x) => { s.snapshots.push(x); },
        registerSnapshotCollector: (x) => { s.snapshotCollectors.push(x); },
        settings: () => settingsOf(id),
      };
    },
  });
  const report = await host.load(enabled);
  const reg: Registry = { sources: new Map(), series: new Map(), collectors: [], derivations: [], settings: new Map(), snapshots: new Map(), snapshotCollectors: [], settingOwner: new Map(), loaded: [], failed: [...report.failed] };
  for (const id of report.loaded) {
    const s = staged.get(id)!;
    const clash = [...s.sources.filter((x) => reg.sources.has(x.id)).map((x) => `source ${x.id}`),
      ...s.series.filter((x) => reg.series.has(x.id)).map((x) => `série ${x.id}`),
      ...s.settings.filter((x) => reg.settings.has(x.key)).map((x) => `réglage ${x.key}`),
      ...s.snapshots.filter((x) => reg.snapshots.has(x.id)).map((x) => `instantané ${x.id}`)];
    if (clash.length) { reg.failed.push({ id, error: `déjà déclaré par un autre plugin : ${clash.join(", ")}` }); continue; }
    for (const x of s.sources) reg.sources.set(x.id, x);
    for (const x of s.series) reg.series.set(x.id, x);
    for (const x of s.settings) { reg.settings.set(x.key, x); reg.settingOwner.set(x.key, id); }
    reg.collectors.push(...s.collectors);
    reg.derivations.push(...s.derivations);
    for (const x of s.snapshots) reg.snapshots.set(x.id, x);
    reg.snapshotCollectors.push(...s.snapshotCollectors);
    reg.loaded.push(id);
  }
  for (const s of reg.series.values()) {
    if (!reg.sources.has(s.sourceId)) throw new Error(`série ${s.id} : source inconnue ${s.sourceId}`);
    for (const d of s.derivedFrom ?? []) if (!reg.series.has(d)) throw new Error(`série ${s.id} : dérivée d'une série inconnue ${d}`);
  }
  for (const s of reg.snapshots.values()) {
    if (!reg.sources.has(s.sourceId)) throw new Error(`instantané ${s.id} : source inconnue ${s.sourceId}`);
    if (!(Number.isInteger(s.keepDays) && s.keepDays > 0)) throw new Error(`instantané ${s.id} : keepDays doit être un entier positif`);
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

/** Un instantané vide, mal daté, ou avec deux fois la même clé est refusé : c'est une source qui a changé. */
function assertSnapshot(reg: Registry, c: SnapshotCollector, snap: Snapshot): void {
  if (!reg.snapshots.has(c.snapshot)) throw new Error(`collecteur ${c.id} : instantané non déclaré ${c.snapshot}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snap.date)) throw new Error(`collecteur ${c.id} : date invalide ${snap.date}`);
  if (!snap.items.length) throw new Error(`collecteur ${c.id} : instantané vide (source changée ?)`);
  const keys = new Set(snap.items.map((i) => i.key));
  if (keys.size !== snap.items.length) throw new Error(`collecteur ${c.id} : clés en double dans l'instantané`);
}

/** `skipped` : ancres sur une série dont le plugin n'est pas chargé (non vérifiées, et signalées). */
export type RunReport = { observations: number; anchors: AnchorResult[]; skipped: Anchor[]; warnings: string[] };

/** Une même adresse n'est téléchargée qu'une fois par collecte (ex. l'export des stations, lu par deux
 *  instantanés). */
function memoized(ctx: CollectContext): CollectContext {
  const text = new Map<string, Promise<string>>(), bytes = new Map<string, Promise<Uint8Array>>();
  const once = <T>(m: Map<string, Promise<T>>, url: string, f: (u: string) => Promise<T>) => {
    let p = m.get(url);
    if (!p) { p = f(url); m.set(url, p); p.catch(() => m.delete(url)); }
    return p;
  };
  return { fetchText: (u) => once(text, u, ctx.fetchText), fetchBytes: (u) => once(bytes, u, ctx.fetchBytes), postText: ctx.postText, secret: ctx.secret };
}

export async function runCollect(store: Store, reg: Registry, rawCtx: CollectContext, anchors: readonly Anchor[]): Promise<RunReport> {
  const ctx = memoized(rawCtx);
  const batches: Observation[][] = [];
  for (const c of reg.collectors) {
    const obs = await c.run(ctx);
    assertDeclared(reg, obs, `collecteur ${c.id}`);
    if (!obs.length) throw new Error(`collecteur ${c.id} : aucune donnée (source changée ?)`);
    batches.push(obs);   // pas de push(...obs) : des centaines de milliers d'arguments font déborder la pile
  }
  const collected = batches.flat();
  const snaps: { c: SnapshotCollector; snap: Snapshot }[] = [];
  const warnings: string[] = [];
  for (const c of reg.snapshotCollectors) {
    try {
      const snap = await c.run(ctx);
      assertSnapshot(reg, c, snap);
      snaps.push({ c, snap });
    } catch (e) {
      if (!reg.snapshots.get(c.snapshot)?.optional) throw e;
      warnings.push(`${c.id} : ${e instanceof Error ? e.message : String(e)} (dernier relevé gardé)`);
    }
  }
  const active = anchors.filter((a) => reg.series.has(a.seriesId));
  const skipped = anchors.filter((a) => !reg.series.has(a.seriesId));

  let total = collected.length;
  let results: AnchorResult[] = [];
  store.db.transaction(() => {
    for (const s of reg.sources.values()) store.upsertSource(s);
    for (const s of reg.series.values()) store.upsertSeries(s);
    for (const s of reg.settings.values()) store.putSetting(s.key, s.value, reg.settingOwner.get(s.key) ?? null);
    // un plugin éteint ne laisse rien derrière lui sur le site (ex. mesure d'audience coupée pour de bon)
    store.dropSettingsNotOwnedBy(reg.loaded);
    store.putObservations(collected);
    for (const { c, snap } of snaps) store.putSnapshot(c.snapshot, snap, reg.snapshots.get(c.snapshot)!.keepDays);
    for (const d of reg.derivations) {
      const obs = d.run(store);
      assertDeclared(reg, obs, `dérivation ${d.id}`);
      store.putObservations(obs);
      total += obs.length;
    }
    results = checkAnchors(store, active);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      throw new Error("ancres non respectées, rien n'est écrit :\n" + failed.map((r) =>
        `  ${r.anchor.seriesId} [${r.anchor.from}..${r.anchor.to}] ${r.anchor.aggregate} : attendu ${r.anchor.expected} ±${r.anchor.tolerance} (${r.anchor.publishedBy}), obtenu ${r.actual ?? "aucune donnée"}`).join("\n"));
    }
  })();
  return { observations: total, anchors: results, skipped, warnings };
}
