import { test } from "node:test";
import assert from "node:assert/strict";
import { move } from "./trends.js";

const series = (values: number[], start = "2026-01-01") => values.map((value, i) => ({ seriesId: "x", date: new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), value }));

test("mouvement : écart sur 7 jours, record d'un an seulement avec assez d'historique", () => {
  const m = move("x", series([...Array.from({ length: 40 }, () => 1), 2]), 7)!;
  assert.equal(m.change, 1);
  assert.equal(m.record, "haut");
  assert.equal(move("x", series([1, 2]), 7)!.record, null, "deux jours : pas de record annoncé");
  assert.equal(move("x", series([1, 2]), 7)!.before, null);
  assert.equal(move("x", [], 7), null);
});
