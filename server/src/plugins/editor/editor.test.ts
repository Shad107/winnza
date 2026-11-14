import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CollectContext } from "../../contract.js";
import { buildRegistry, runCollect } from "../../runner.js";
import { Store } from "../../store.js";
import { addDays, parisDate } from "../../units.js";
import { KEYWORDS_SETTING, KEYWORDS_SNAPSHOT } from "../keywords/index.js";
import { checkProposal, EDITOR_SNAPSHOT, editorPlugin, parseEditorDecl, readPage, RUN_KEY, type EditorRun, type Proposal } from "./index.js";

const DECL = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../declarations/editor.json"), "utf8")) as Record<string, unknown>;
const decl = parseEditorDecl(DECL);
const HTML = `<html><head><title>Coût aux 100 km : diesel, essence | Winnza</title><meta name="description" content="Combien coûtent 100 km &#39;au prix du jour&#39;."></head>
<body><h1 class="h1" id="titre">Combien coûtent 100&#160;km&#160;?</h1><p class="intro">Chaque motorisation <b>côte à côte</b>.</p></body></html>`;

test("page en ligne : titre, description, titre visible et introduction, entités décodées", () => {
  assert.deepEqual(readPage(HTML), { title: "Coût aux 100 km : diesel, essence | Winnza", description: "Combien coûtent 100 km 'au prix du jour'.",
    h1: "Combien coûtent 100 km ?", intro: "Chaque motorisation côte à côte ." });
  assert.throws(() => readPage("<html></html>"), /sans <title>/);
});

test("contrôles : longueur, tiret cadratin, marque, chiffre inventé ; une bonne proposition passe", () => {
  const now = readPage(HTML);
  const good = { title: "Coût aux 100 km : électrique ou essence, au prix du jour", description: "Diesel, essence, E85, GPL, électrique à la maison ou sur borne : combien coûtent vraiment 100 km aujourd'hui." };
  assert.deepEqual(checkProposal(good, now, decl), []);
  assert.match(checkProposal({ ...good, title: good.title + " et bien plus encore pour tout le monde" }, now, decl).join(), /caractères/);
  assert.match(checkProposal({ ...good, title: "Coût aux 100 km \u2014 au prix du jour" }, now, decl).join(), /tiret/);
  assert.match(checkProposal({ ...good, title: "Coût aux 100 km | Winnza" }, now, decl).join(), /Winnza/);
  assert.match(checkProposal({ ...good, description: good.description + " Dès 2,67 € les 100 km." }, now, decl).join(), /chiffre « 2,67 »/);
  assert.match(checkProposal({ ...good, title: "Coût aux 200 km" }, now, decl).join(), /chiffre « 200 »/, "un nombre absent, même rond");
});

test("déclaration : une clé collée à la place du nom de variable est refusée", () => {
  assert.throws(() => parseEditorDecl({ ...DECL, api: { ...(DECL.api as object), keySecret: "sk-ant-api03-xyz" } }), /NOM de variable/);
});

// --- collecte, sans aucun appel réel ---
const GROUPS = [{ id: "cout", page: "/cout-aux-100-km", label: "Coût aux 100 km", seeds: ["cout 100 km"] }];
function seeded(): Store {
  const store = new Store(":memory:");
  store.putSetting(KEYWORDS_SETTING, GROUPS);
  store.putSnapshot(KEYWORDS_SNAPSHOT, { date: parisDate(), items: [{ key: "cout|prix recharge voiture electrique", value: { group: "cout", text: "prix recharge voiture electrique", volume: 4400, competition: "LOW", seed: false, months: [] } }] }, 30);
  return store;
}
const MESSAGE = (proposal: object) => JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
  content: [{ type: "text", text: JSON.stringify({ proposals: [proposal] }) }], usage: { input_tokens: 10_000, output_tokens: 2_000 } });
function fake(opts: { key?: boolean; proposal?: object } = {}) {
  const posts: string[] = [];
  const ctx: CollectContext = {
    fetchBytes: async () => new Uint8Array(),
    fetchText: async (url) => { if (url !== `${decl.site}/cout-aux-100-km`) throw new Error(`GET inattendu ${url}`); return HTML; },
    secret: (n) => (opts.key === false ? null : n === decl.api.keySecret ? "cle-de-test" : null),
    postText: async (url) => { posts.push(url); return MESSAGE(opts.proposal ?? { path: "/cout-aux-100-km", title: "Prix de la recharge et coût aux 100 km", description: "Diesel, essence, E85, GPL, électrique à la maison ou sur borne : ce que coûtent vraiment 100 km aujourd'hui.", keywords: ["prix recharge voiture electrique"], reason: "volume" }); },
  };
  return { ctx, posts };
}
const collect = async (store: Store, ctx: CollectContext) => runCollect(store, await buildRegistry({ editor: editorPlugin }, ["editor"], () => DECL), ctx, []);
const latest = (store: Store) => store.snapshot(EDITOR_SNAPSHOT, store.snapshotDates(EDITOR_SNAPSHOT).at(-1)!);

test("collecte : une requête, la proposition contrôlée, la dépense comptée au tarif déclaré", async () => {
  const store = seeded();
  const f = fake();
  const r = await collect(store, f.ctx);
  assert.deepEqual(r.warnings, []);
  assert.equal(f.posts.length, 1);
  const run = latest(store).find((i) => i.key === RUN_KEY)!.value as EditorRun;
  assert.ok(Math.abs(run.costUsd - (10_000 * 4 + 2_000 * 20) / 1e6) < 1e-12);
  const p = latest(store).find((i) => i.key === "/cout-aux-100-km")!.value as Proposal;
  assert.deepEqual(p.problems, []);
  assert.equal(p.current.title, "Coût aux 100 km : diesel, essence | Winnza");
});

test("rythme : le lendemain, rien n'est dépensé, les propositions sont recopiées", async () => {
  const store = seeded();
  await collect(store, fake().ctx);
  const items = latest(store);
  // on vieillit le passage d'un jour : il reste dans la semaine
  store.putSnapshot(EDITOR_SNAPSHOT, { date: addDays(parisDate(), -1), items: items.map((i) => (i.key === RUN_KEY ? { ...i, value: { ...(i.value as EditorRun), date: addDays(parisDate(), -1) } } : i)) }, 120);
  store.db.prepare("DELETE FROM snapshot_item WHERE snapshot = ? AND date = ?").run(EDITOR_SNAPSHOT, parisDate());
  const f = fake();
  await collect(store, f.ctx);
  assert.equal(f.posts.length, 0, "dans la semaine : aucun appel");
  assert.equal(latest(store).length, items.length);
});

// Témoins : sans clé ou budget épuisé, aucun appel, la collecte continue et le dit.
test("budget du mois atteint : aucun appel, avertissement", async () => {
  const store = seeded();
  // un passage du jour qui a déjà tout dépensé (sans proposition : rien à recopier)
  const spent: EditorRun = { runId: "ancien", date: parisDate(), model: "m", inputTokens: 0, outputTokens: 0, costUsd: decl.budget.monthlyUsd };
  store.putSnapshot(EDITOR_SNAPSHOT, { date: parisDate(), items: [{ key: RUN_KEY, value: spent }] }, 120);
  const f = fake();
  const r = await collect(store, f.ctx);
  assert.equal(f.posts.length, 0);
  assert.match(r.warnings.join(), /budget du mois atteint/);
});

test("clé absente : aucun appel, la variable est nommée", async () => {
  const f = fake({ key: false });
  const r = await collect(seeded(), f.ctx);
  assert.equal(f.posts.length, 0);
  assert.match(r.warnings.join(), /ANTHROPIC_API_KEY absente/);
});

test("proposition avec un chiffre inventé : gardée, mais marquée, donc non publiable", async () => {
  const store = seeded();
  await collect(store, fake({ proposal: { path: "/cout-aux-100-km", title: "100 km dès 2,67 €", description: "Le coût aux 100 km de chaque motorisation, au prix du jour, du diesel à l'électrique.", keywords: [], reason: "" } }).ctx);
  const p = latest(store).find((i) => i.key === "/cout-aux-100-km")!.value as Proposal;
  assert.match(p.problems.join(), /2,67/);
});
