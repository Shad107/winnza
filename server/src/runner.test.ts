import { test } from "node:test";
import assert from "node:assert/strict";
import { AGGREGATE, parseAnchors, type Anchor } from "./anchors.js";
import { FREQUENCY, UNIT, type CollectContext, type Plugin } from "./contract.js";
import { runCollect } from "./runner.js";
import { Store } from "./store.js";

const noNet: CollectContext = { fetchBytes: async () => new Uint8Array(), fetchText: async () => "" };

const plugin: Plugin = {
  id: "t", title: "test",
  register(api) {
    api.declareSource({ id: "src", name: "s", publisher: "p", url: "u", licence: "l" });
    api.declareSeries({ id: "x", label: "x", unit: UNIT.eurPerLitre, frequency: FREQUENCY.daily, sourceId: "src" });
    api.registerCollector({ id: "c", run: async () => [{ seriesId: "x", date: "2020-01-01", value: 2 }] });
  },
};
const anchor = (expected: number): Anchor => ({ seriesId: "x", from: "2020-01-01", to: "2020-01-31", aggregate: AGGREGATE.mean,
  expected, tolerance: 0.1, publishedBy: "test", url: "u" });

test("une ancre respectée : la collecte écrit", async () => {
  const store = new Store(":memory:");
  const r = await runCollect(store, [plugin], noNet, [anchor(2)]);
  assert.equal(r.anchors[0]!.ok, true);
  assert.equal(store.get("x").length, 1);
});

// Témoin de mutation : le contrôle doit SAVOIR échouer, et l'échec ne doit rien laisser en base.
test("une ancre violée : la collecte échoue et la base reste vide", async () => {
  const store = new Store(":memory:");
  await assert.rejects(runCollect(store, [plugin], noNet, [anchor(3)]), /ancres non respectées/);
  assert.equal(store.get("x").length, 0);
});

test("une observation d'une série non déclarée est refusée", async () => {
  const bad: Plugin = { ...plugin, register(api) { plugin.register(api); api.registerCollector({ id: "d", run: async () => [{ seriesId: "typo", date: "2020-01-01", value: 1 }] }); } };
  await assert.rejects(runCollect(new Store(":memory:"), [bad], noNet, []), /série non déclarée typo/);
});

test("anchors.json : un agrégat inconnu est une erreur", () => {
  assert.throws(() => parseAnchors([{ ...anchor(1), aggregate: "median" }]), /agrégat inconnu/);
});
