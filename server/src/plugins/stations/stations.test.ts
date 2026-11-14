import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry, runCollect } from "../../runner.js";
import { Store } from "../../store.js";
import { parisDate, parseAggregate, parseStationExport, stationExportUrl, parseStationsDecl, stationQueries, stationSeriesId, stationsPlugin, AREA_FRANCE, areaOfDepartment } from "./index.js";

const decl = {
  source: { id: "flux", name: "n", publisher: "p", url: "https://exemple/api", licence: "l" },
  fuels: [{ id: "gazole", label: "Gazole", field: "gazole" }],
  maxAgeDays: 7, plausible: { min: 0.3, max: 5 },
  departments: [{ code: "01", label: "Ain" }, { code: "2A", label: "Corse-du-Sud" }],
  keepDays: 35,
};

test("requêtes : prix récents seulement, agrégés par la source, France et départements", () => {
  const q = stationQueries(parseStationsDecl(decl), decl.fuels[0]!);
  const nat = new URL(q.national).searchParams;
  assert.equal(nat.get("select"), "avg(gazole_prix) as avg, count(*) as n");
  assert.equal(nat.get("where"), "gazole_maj >= now(days=-7) and gazole_prix > 0");
  assert.equal(new URL(q.byDepartment).searchParams.get("group_by"), "code_departement");
});

test("réglages : un champ qui n'est pas un identifiant simple est refusé (il entre dans la requête)", () => {
  assert.throws(() => parseStationsDecl({ ...decl, fuels: [{ id: "x", label: "x", field: "gazole_prix) or (1=1" }] }), /champ invalide/);
  assert.throws(() => parseStationsDecl({ ...decl, plausible: { min: 5, max: 1 } }), /inférieur/);
});

test("réponse agrégée : lignes vides ignorées, département lu", () => {
  const rows = parseAggregate(JSON.stringify({ results: [{ avg: 2.1, n: 12, code_departement: "01" }, { avg: null, n: 0 }] }));
  assert.deepEqual(rows, [{ avg: 2.1, n: 12, dep: "01" }]);
});

test("date du jour à Paris, pas celle du serveur", () => {
  assert.equal(parisDate(new Date("2026-11-13T23:30:00Z")), "2026-11-14");
});

function fakeNet(nationalAvg: number) {
  return {
    fetchBytes: async () => new Uint8Array(),
    fetchText: async (url: string) => url.includes("/exports/")
      ? JSON.stringify([{ id: 1, geom: { lat: 46, lon: 5 }, code_departement: "01", gazole_prix: 2.2, gazole_maj: "2026-11-13" }])
      : JSON.stringify({ results: new URL(url).searchParams.get("group_by")
      ? [{ code_departement: "01", avg: 2.2, n: 120 }, { code_departement: "99", avg: 2.3, n: 3 }, { code_departement: "2A", avg: 2.4, n: 40 }]
      : [{ avg: nationalAvg, n: 9800 }] }),
  };
}

test("collecte : France et départements connus ; un département inconnu est ignoré", async () => {
  const store = new Store(":memory:");
  const reg = await buildRegistry({ stations: stationsPlugin }, ["stations"], () => decl);
  await runCollect(store, reg, fakeNet(2.17), []);
  assert.deepEqual(store.get(stationSeriesId(AREA_FRANCE, "gazole", "avg")).map((o) => o.value), [2.17]);
  assert.deepEqual(store.get(stationSeriesId(areaOfDepartment("2A"), "gazole", "count")).map((o) => o.value), [40]);
  assert.equal(reg.series.has(stationSeriesId(areaOfDepartment("99"), "gazole", "avg")), false);
});

// Témoin : une moyenne absurde (ex. des millièmes d'euro) fait échouer la collecte, rien n'est écrit.
test("une moyenne hors des bornes plausibles arrête la collecte", async () => {
  const store = new Store(":memory:");
  const reg = await buildRegistry({ stations: stationsPlugin }, ["stations"], () => decl);
  await assert.rejects(runCollect(store, reg, fakeNet(2170), []), /hors des bornes plausibles/);
  assert.equal(store.get(stationSeriesId(AREA_FRANCE, "gazole", "avg")).length, 0);
});

test("export des stations : position, adresse, prix plausibles seulement ; une station sans prix est écartée", () => {
  const d = parseStationsDecl(decl);
  assert.ok(new URL(stationExportUrl(d)).searchParams.get("select")!.split(",").includes("gazole_maj"));
  const items = parseStationExport(JSON.stringify([
    { id: 1, geom: { lat: 48.1, lon: -2.7 }, adresse: " 16 rue X ", ville: "Bréhan", cp: "56580", code_departement: "56", horaires_automate_24_24: "Oui", gazole_prix: 2.109, gazole_maj: "2026-11-12T06:55:20+00:00" },
    { id: 2, geom: { lat: 48, lon: 2 }, gazole_prix: 21.09, gazole_maj: "2026-11-12T06:55:20+00:00" },
    { id: 3, geom: null, gazole_prix: 2.1, gazole_maj: "2026-11-12" },
  ]), d);
  assert.deepEqual(items, [{ key: "1", value: { lat: 48.1, lon: -2.7, address: "16 rue X", city: "Bréhan", cp: "56580", dep: "56", h24: true,
    prices: { gazole: { price: 2.109, updated: "2026-11-12" } } } }]);
});
