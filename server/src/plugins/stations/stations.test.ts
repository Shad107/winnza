import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry, runCollect } from "../../runner.js";
import { Store } from "../../store.js";
import { NO_POST_NO_SECRET } from "../../test-net.js";
import { parisDate, parseStationExport, stationExportUrl, parseStationsDecl, stationSeriesId, stationsPlugin, stationPrices, AREA_FRANCE, areaOfDepartment, areaOfRegion, STATION_PRICES_SNAPSHOT } from "./index.js";

const decl = {
  source: { id: "flux", name: "n", publisher: "p", url: "https://exemple/api", licence: "l" },
  fuels: [{ id: "gazole", label: "Gazole", field: "gazole" }],
  maxAgeDays: 7, plausible: { min: 0.3, max: 5 },
  departments: [{ code: "01", label: "Ain" }, { code: "2A", label: "Corse-du-Sud" }],
  regions: [{ code: "84", label: "Auvergne-Rhône-Alpes" }],
  keepDays: 35, historyDays: 3650,
};

test("réglages : un champ qui n'est pas un identifiant simple est refusé (il entre dans la requête)", () => {
  assert.throws(() => parseStationsDecl({ ...decl, fuels: [{ id: "x", label: "x", field: "gazole_prix,adresse" }] }), /champ invalide/);
  assert.throws(() => parseStationsDecl({ ...decl, plausible: { min: 5, max: 1 } }), /inférieur/);
});

test("date du jour à Paris, pas celle du serveur", () => {
  assert.equal(parisDate(new Date("2026-11-13T23:30:00Z")), "2026-11-14");
});

const row = (id: number, dep: string, region: string, price: number, maj: string) =>
  ({ id, geom: { lat: 46, lon: 5 }, code_departement: dep, code_region: region, gazole_prix: price, gazole_maj: maj });

function fakeNet(rows: unknown[]) {
  let calls = 0;
  return { calls: () => calls, ctx: { ...NO_POST_NO_SECRET, fetchBytes: async () => new Uint8Array(), fetchText: async () => { calls++; return JSON.stringify(rows); } } };
}

test("collecte : nos moyennes France, région, département, sur les prix à jour ; un seul téléchargement", async () => {
  const today = parisDate();
  const old = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const net = fakeNet([row(1, "01", "84", 2.0, today), row(2, "01", "84", 2.2, today), row(3, "2A", "94", 2.4, today), row(4, "99", "00", 1.0, today), row(5, "01", "84", 1.5, old)]);
  const store = new Store(":memory:");
  await runCollect(store, await buildRegistry({ stations: stationsPlugin }, ["stations"], () => decl), net.ctx, []);
  const v = (area: string, w: "avg" | "count") => store.get(stationSeriesId(area, "gazole", w)).map((o) => Math.round(o.value * 1000) / 1000);
  assert.deepEqual(v(AREA_FRANCE, "avg"), [1.9], "France : toutes les stations à jour, même d'un département non déclaré");
  assert.deepEqual(v(areaOfDepartment("01"), "avg"), [2.1], "le prix vieux de 30 jours ne compte pas");
  assert.deepEqual(v(areaOfRegion("84"), "count"), [2]);
  assert.equal(store.snapshot(STATION_PRICES_SNAPSHOT, today).length, 4, "l'historique garde chaque station à prix à jour");
  assert.equal(net.calls(), 1, "deux instantanés, un seul téléchargement");
});

// Témoin : la source passe en millièmes d'euro, tous les prix sont écartés, la collecte échoue sans rien écrire.
test("prix tous hors des bornes plausibles : la collecte s'arrête, rien n'est écrit", async () => {
  const store = new Store(":memory:");
  const net = fakeNet([row(1, "01", "84", 2170, parisDate()), row(2, "01", "84", 2210, parisDate())]);
  await assert.rejects(runCollect(store, await buildRegistry({ stations: stationsPlugin }, ["stations"], () => decl), net.ctx, []), /instantané vide/);
  assert.equal(store.get(stationSeriesId(AREA_FRANCE, "gazole", "avg")).length, 0);
});

test("historique : seuls les prix mis à jour depuis maxAgeDays jours", () => {
  const items = stationPrices([{ key: "1", value: { prices: { gazole: { price: 2, updated: "2026-11-10" }, e85: { price: 0.9, updated: "2026-10-01" } }, dep: "01", region: "84", cp: "01000", city: "Bourg" } }], "2026-11-14", 7);
  assert.deepEqual(items, [{ key: "1", value: { dep: "01", region: "84", cp: "01000", city: "Bourg", p: { gazole: 2 } } }]);
});

test("export des stations : position, adresse, prix plausibles seulement ; une station sans prix est écartée", () => {
  const d = parseStationsDecl(decl);
  assert.ok(new URL(stationExportUrl(d)).searchParams.get("select")!.split(",").includes("gazole_maj"));
  const items = parseStationExport(JSON.stringify([
    { id: 1, geom: { lat: 48.1, lon: -2.7 }, adresse: " 16 rue X ", ville: "Bréhan", cp: "56580", code_departement: "56", horaires_automate_24_24: "Oui", gazole_prix: 2.109, gazole_maj: "2026-11-12T06:55:20+00:00" },
    { id: 2, geom: { lat: 48, lon: 2 }, gazole_prix: 21.09, gazole_maj: "2026-11-12T06:55:20+00:00" },
    { id: 3, geom: null, gazole_prix: 2.1, gazole_maj: "2026-11-12" },
  ]), d);
  assert.deepEqual(items, [{ key: "1", value: { lat: 48.1, lon: -2.7, address: "16 rue X", city: "Bréhan", cp: "56580", dep: "56", region: "", h24: true,
    prices: { gazole: { price: 2.109, updated: "2026-11-12" } } } }]);
});
