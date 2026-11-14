import { test } from "node:test";
import assert from "node:assert/strict";
import type { Observation, SiteReader } from "../contract.js";
import { MAP_SETTING } from "../plugins/map/index.js";
import { STATIONS_CATALOG_SETTING, stationSeriesId } from "../plugins/stations/index.js";
import { buildDepartmentsPage } from "./departments-page.js";

const map = { source: { id: "s", name: "n", publisher: "p", url: "u", licence: "l" }, viewBox: [10, 10], shapes: [{ code: "01", label: "Ain", d: "M0 0l1 1Z" }, { code: "02", label: "Aisne", d: "M1 1l1 1Z" }] };
const catalog = { fuels: [{ id: "gazole", label: "Gazole" }] };
const o = (id: string, date: string, value: number): Observation => ({ seriesId: id, date, value });
const reader = (obs: Observation[], settings: Record<string, unknown>): SiteReader => ({
  get: (id) => obs.filter((x) => x.seriesId === id).sort((a, b) => a.date.localeCompare(b.date)), ids: () => [],
  setting: (k) => settings[k], settingOrNull: (k) => settings[k] ?? null, series: () => null, source: () => null,
});

test("départements : prix du jour de la France, variation seulement si le relevé d'il y a 7 jours existe", () => {
  const obs = [
    o(stationSeriesId("FR", "gazole", "avg"), "2026-11-20", 2.1),
    o(stationSeriesId("dep-01", "gazole", "avg"), "2026-11-13", 2.2), o(stationSeriesId("dep-01", "gazole", "avg"), "2026-11-20", 2.15),
    o(stationSeriesId("dep-01", "gazole", "count"), "2026-11-20", 80),
    o(stationSeriesId("dep-02", "gazole", "avg"), "2026-11-19", 2.0), o(stationSeriesId("dep-02", "gazole", "count"), "2026-11-19", 50),
  ];
  const page = buildDepartmentsPage(reader(obs, { [MAP_SETTING]: map, [STATIONS_CATALOG_SETTING]: catalog }))!;
  assert.deepEqual(page.fuels, [{ id: "gazole", label: "Gazole", date: "2026-11-20", france: 2.1 }]);
  const ain = page.departments[0]!.prices.gazole!;
  assert.equal(ain.avg, 2.15); assert.equal(ain.stations, 80); assert.ok(Math.abs(ain.change! + 0.05) < 1e-9);
  assert.deepEqual(page.departments[1]!.prices, {}, "relevé d'un autre jour : pas mélangé à celui du jour");
});

test("départements : sans le plugin carte, pas de page", () => {
  assert.equal(buildDepartmentsPage(reader([], { [STATIONS_CATALOG_SETTING]: catalog })), null);
});

test("carte : un tracé qui contient autre chose que des commandes et des nombres est refusé", async () => {
  const { parseMapDecl } = await import("../plugins/map/index.js");
  assert.throws(() => parseMapDecl({ ...map, shapes: [{ code: "01", label: "Ain", d: "M0 0\"/><script>" }] }), /tracé invalide/);
});
