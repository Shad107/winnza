import { test } from "node:test";
import assert from "node:assert/strict";
import type { SiteReader, SnapshotItem } from "../contract.js";
import { STATIONS_CATALOG_SETTING, STATIONS_SNAPSHOT } from "../plugins/stations/index.js";
import { buildStationsMap } from "./stations-map.js";

const st = (price: number, updated: string) => ({ lat: 48, lon: -1.6, address: "1 rue A", city: "Rennes", cp: "35000", dep: "35", h24: true, prices: { gazole: { price, updated } } });
const reader = (snaps: Record<string, SnapshotItem[]>): SiteReader => ({
  get: () => [], ids: () => [], series: () => null, source: () => null, setting: () => null,
  settingOrNull: (k) => (k === STATIONS_CATALOG_SETTING ? { fuels: [{ id: "gazole", label: "Gazole" }], maxAgeDays: 7 } : null),
  snapshotDates: (id) => (id === STATIONS_SNAPSHOT ? Object.keys(snaps).sort() : []),
  snapshot: (id, d) => (id === STATIONS_SNAPSHOT ? snaps[d] ?? [] : []),
});

test("carte des stations : prix du jour, prix ancien signalé, variation seulement avec le relevé d'il y a 7 jours", () => {
  const m = buildStationsMap(reader({
    "2026-11-13": [{ key: "1", value: st(2.2, "2026-11-12") }],
    "2026-11-20": [{ key: "1", value: st(2.15, "2026-11-19") }, { key: "2", value: st(2.0, "2026-11-01") }],
  }))!;
  assert.equal(m.compareDate, "2026-11-13");
  assert.deepEqual(m.features[0]!.properties, { k: "1", a: "1 rue A", c: "Rennes", cp: "35000", h: 1, p_gazole: 2.15, d_gazole: -0.05 });
  assert.equal(m.features[1]!.properties.o_gazole, 1, "prix vieux de 19 jours : signalé");
  assert.equal(m.features[1]!.properties.d_gazole, undefined, "station absente il y a 7 jours : pas de variation");
});

test("carte des stations : pas d'historique de 7 jours, pas de variation", () => {
  const m = buildStationsMap(reader({ "2026-11-14": [{ key: "1", value: st(2.2, "2026-11-14") }] }))!;
  assert.equal(m.compareDate, null);
  assert.equal(m.features[0]!.properties.d_gazole, undefined);
});
