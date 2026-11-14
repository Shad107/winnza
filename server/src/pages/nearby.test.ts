import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, nearby } from "./nearby.js";
import type { StationFeature } from "./stations-map.js";

const f = (k: string, lon: number, lat: number, props: Record<string, number>): StationFeature =>
  ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { k, a: "rue", c: "Rennes", ...props } });

test("distance : Rennes à Nantes, environ 99 km à vol d'oiseau", () => {
  assert.ok(Math.abs(distanceKm(-1.6778, 48.1173, -1.5536, 47.2184) - 99.6) < 1.5);
});

test("autour de vous : prix à jour dans le rayon, du moins cher au plus cher, la plus proche à prix égal", () => {
  const r = nearby([
    f("loin", -1.0, 48.1, { p_gazole: 1.5 }),
    f("vieux", -1.68, 48.12, { p_gazole: 1.6, o_gazole: 1 }),
    f("a", -1.70, 48.12, { p_gazole: 2.1 }),
    f("b", -1.66, 48.11, { p_gazole: 2.0 }),
    f("c", -1.678, 48.117, { p_gazole: 2.0 }),
    f("sp", -1.67, 48.11, { p_sp98: 2.2 }),
  ], "gazole", -1.6778, 48.1173)!;
  assert.deepEqual(r.cheapest.map((s) => s.key), ["c", "b", "a"]);
  assert.equal(r.count, 3); assert.equal(r.dearest, 2.1); assert.ok(Math.abs(r.average - 6.1 / 3) < 1e-9);
});

test("autour de vous : aucune station dans le rayon, rien à dire", () => {
  assert.equal(nearby([f("loin", 5, 45, { p_gazole: 2 })], "gazole", -1.6, 48.1), null);
});
