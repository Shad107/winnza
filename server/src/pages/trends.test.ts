import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store.js";
import { buildTrends } from "./trends.js";

test("tendances : base vide, rien d'inventé (pas de mots-clés, pas de Search Console)", () => {
  const t = buildTrends(new Store(":memory:"), "2026-11-17");
  assert.equal(t.keywordsDate, null);
  assert.deepEqual(t.searches.rising, []);
  assert.equal(t.searchConsole, null);
});
