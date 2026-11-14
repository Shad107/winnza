import { test } from "node:test";
import assert from "node:assert/strict";
import type { Observation, SiteReader, SnapshotItem } from "../contract.js";
import { STATIONS_CATALOG_SETTING, STATIONS_SNAPSHOT, stationSeriesId, type StationRecord } from "../plugins/stations/index.js";
import { buildCities, citySlug } from "./cities.js";

test("adresse d'une ville : sans accents ni ligatures, département compris", () => {
  assert.equal(citySlug("Saint-Étienne-du-Rouvray", "76"), "saint-etienne-du-rouvray-76");
  assert.equal(citySlug("L'Haÿ-les-Roses", "94"), "l-hay-les-roses-94");
  assert.equal(citySlug("Bœurs-en-Othe", "89"), "boeurs-en-othe-89");
  assert.equal(citySlug("Ajaccio", "2A"), "ajaccio-2a");
});

const st = (city: string, dep: string, lon: number, lat: number, gazole?: [number, string]): StationRecord => ({
  lat, lon, address: `1 rue de ${city}`, city, cp: "35000", dep, region: "53", h24: false,
  prices: gazole ? { gazole: { price: gazole[0], updated: gazole[1] } } : {},
});
const catalog = { fuels: [{ id: "gazole", label: "Gazole" }], departments: [{ code: "35", label: "Ille-et-Vilaine" }, { code: "974", label: "La Réunion" }], maxAgeDays: 7 };
function reader(snaps: Record<string, SnapshotItem[]>, obs: Observation[] = []): SiteReader {
  return {
    get: (id) => obs.filter((o) => o.seriesId === id), ids: () => [], series: () => null, source: () => null,
    setting: (k) => (k === STATIONS_CATALOG_SETTING ? catalog : null), settingOrNull: (k) => (k === STATIONS_CATALOG_SETTING ? catalog : null),
    snapshotDates: (id) => (id === STATIONS_SNAPSHOT ? Object.keys(snaps).sort() : []), snapshot: (id, d) => (id === STATIONS_SNAPSHOT ? snaps[d] ?? [] : []),
  };
}
const TODAY = "2026-11-21", WEEK_AGO = "2026-11-14";

test("villes : moyenne des prix à jour, la moins chère, écart à 7 jours, département, voisines", () => {
  const today = [
    { key: "1", value: st("Rennes", "35", -1.68, 48.11, [2.0, TODAY]) },
    { key: "2", value: st("Rennes", "35", -1.67, 48.12, [2.2, TODAY]) },
    { key: "3", value: st("Rennes", "35", -1.66, 48.10, [1.0, "2026-10-01"]) },
    { key: "4", value: st("Cesson-Sévigné", "35", -1.60, 48.12, [1.9, TODAY]) },
    { key: "5", value: st("Saint-Denis", "974", 55.45, -20.88, [1.5, TODAY]) },
  ];
  const week = [{ key: "1", value: st("Rennes", "35", -1.68, 48.11, [1.9, WEEK_AGO]) }];
  const obs = [{ seriesId: stationSeriesId("dep-35", "gazole", "avg"), date: TODAY, value: 2.05 }];
  const c = buildCities(reader({ [WEEK_AGO]: week, [TODAY]: today }, obs))!;
  const rennes = c.bySlug.get("rennes-35")!;
  const g = rennes.fuels[0]!;
  assert.ok(Math.abs(g.avg - 2.1) < 1e-9, "le prix d'octobre ne compte pas");
  assert.equal(g.count, 2);
  assert.deepEqual(g.cheapest, { key: "1", price: 2.0 });
  assert.ok(Math.abs(g.change! - 0.2) < 1e-9);
  assert.equal(g.department, 2.05);
  assert.equal(g.france, null, "pas de moyenne nationale du jour : rien d'inventé");
  assert.equal(rennes.stations.length, 3, "la station au prix périmé reste listée, sans ce prix");
  assert.deepEqual(rennes.nearby.map((n) => n.slug), ["cesson-sevigne-35"], "La Réunion n'est pas voisine de Rennes");
  assert.deepEqual(c.list.map((x) => x.slug), ["cesson-sevigne-35", "rennes-35", "saint-denis-974"]);
  assert.equal(c.bySlug.get("cesson-sevigne-35")!.fuels[0]!.change, null, "pas de relevé il y a 7 jours dans cette ville");
});

test("villes : pas de relevé des stations, pas de pages", () => {
  assert.equal(buildCities(reader({})), null);
});
