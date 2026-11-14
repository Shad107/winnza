import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Observation, SiteReader } from "../contract.js";
import { STATIONS_CATALOG_SETTING, stationSeriesId } from "../plugins/stations/index.js";
import { ELEC_CATALOG_SETTING, TRV_PART, trvSeriesId } from "../plugins/electricity/series-ids.js";
import { parseElecCatalog } from "../plugins/electricity/decl.js";
import { parseRunningCost, referenceSeriesId, RUNNING_COST_SETTING } from "../plugins/running-cost/index.js";
import { buildRunningCostPage, PRICE_KIND } from "./running-cost-page.js";

// les vraies déclarations : ce qui part en production est ce qui est éprouvé
const decl = (f: string) => JSON.parse(readFileSync(join(import.meta.dirname, "../../../declarations", f), "utf8")) as Record<string, unknown>;
const RC = decl("running-cost.json");
const ELEC = parseElecCatalog(decl("electricity.json"));
const FUELS = { fuels: ["gazole", "sp95", "e10", "sp98", "e85", "gplc"].map((id) => ({ id, label: id.toUpperCase() })) };

const o = (seriesId: string, date: string, value: number): Observation => ({ seriesId, date, value });
const reader = (obs: Observation[], settings: Record<string, unknown>): SiteReader => ({
  get: (id) => obs.filter((x) => x.seriesId === id).sort((a, b) => a.date.localeCompare(b.date)), ids: () => [],
  setting: (k) => settings[k], settingOrNull: (k) => settings[k] ?? null, series: () => null, source: () => null, snapshotDates: () => [], snapshot: () => [],
});
const pump = (fuel: string, v: number) => o(stationSeriesId("FR", fuel, "avg"), "2026-11-14", v);
const trv = (opt: string, period: string, v: number) => o(trvSeriesId(opt, 6, period, TRV_PART.ttc), "2026-08-01", v);
const OBS = [pump("gazole", 1.8), pump("sp95", 1.9), pump("e10", 1.85), pump("sp98", 2.0), pump("e85", 0.8), pump("gplc", 1.0),
  trv("base", "kwh", 0.2), trv("hphc", "hc", 0.16), trv("tempo", "blue-hc", 0.13), o(referenceSeriesId("fast-charge"), "2026-10-30", 0.51)];
const ALL = { [RUNNING_COST_SETTING]: JSON.parse(JSON.stringify(parseRunningCost(RC))) as unknown, [STATIONS_CATALOG_SETTING]: FUELS, [ELEC_CATALOG_SETTING]: ELEC };

test("coût aux 100 km : consommation × prix, facteur compris, du moins cher au plus cher", () => {
  const page = buildRunningCostPage(reader(OBS, ALL))!;
  const row = (id: string) => page.rows.find((r) => r.id === id)!;
  assert.ok(Math.abs(row("e85").per100 - 6.7 * 1.25 * 0.8) < 1e-9, "E85 : 25 % de litres en plus");
  assert.ok(Math.abs(row("ev-tempo").per100 - 19.7 * 0.13) < 1e-9);
  assert.equal(row("ev-fast").priceKind, PRICE_KIND.declared);
  assert.equal(row("ev-fast").priceDate, "2026-10-30");
  assert.equal(page.rows[0]!.id, "ev-tempo");
  assert.deepEqual(page.rows.map((r) => r.per100), [...page.rows.map((r) => r.per100)].sort((a, b) => a - b));
});

test("plugin électricité éteint : les motorisations électriques à la maison disparaissent, pas la page", () => {
  const { [ELEC_CATALOG_SETTING]: _e, ...rest } = ALL;
  const ids = buildRunningCostPage(reader(OBS, rest))!.rows.map((r) => r.id);
  assert.ok(!ids.includes("ev-base") && ids.includes("gazole") && ids.includes("ev-fast"));
});

test("carburant inconnu des stations : erreur de configuration, pas une ligne vide", () => {
  const vehicles = (RC.vehicles as Record<string, unknown>[]).map((v) => (v.id === "gazole" ? { ...v, price: { station: "diesel" } } : v));
  assert.throws(() => buildRunningCostPage(reader(OBS, { ...ALL, [RUNNING_COST_SETTING]: { ...RC, vehicles } })), /carburant inconnu « diesel »/);
});

// Le plugin stocke le catalogue DÉJÀ LU ; la page le relit. Les deux formes doivent passer le même contrôle.
test("catalogues : relus tels que stockés en base, sans erreur et à l'identique", () => {
  const rc = parseRunningCost(RC);
  assert.deepEqual(parseRunningCost(JSON.parse(JSON.stringify(rc))), rc);
  assert.deepEqual(parseElecCatalog(JSON.parse(JSON.stringify(ELEC))), ELEC);
});

test("déclaration : consommation inconnue, ou prix au kWh pour une consommation en litres, refusés", () => {
  const vehicles = RC.vehicles as Record<string, unknown>[];
  assert.throws(() => parseRunningCost({ ...RC, vehicles: [{ ...vehicles[0], consumption: "hydrogen" }] }), /consommation inconnue/);
  assert.throws(() => parseRunningCost({ ...RC, distance: { ...(RC.distance as object), step: 500 } }), /pas du curseur/, "12 200 n'est pas sur la grille 2 000 + n × 500");
  assert.throws(() => parseRunningCost({ ...RC, vehicles: [{ ...vehicles[0], price: { reference: "fast-charge" } }] }), /prix en kWh pour une consommation en L/);
});
