import { test } from "node:test";
import assert from "node:assert/strict";
import { FREQUENCY, UNIT, type Observation, type SeriesDecl, type SiteReader, type SourceDecl } from "../contract.js";
import { FUEL_CATALOG_SETTING, FUEL_PART, fuelSeriesId, OIL_SERIES } from "../plugins/fuel/series-ids.js";
import { chargeSeriesId, chargeSourceId, HIDDEN_CHARGES_SETTING, parseHiddenCharges } from "../plugins/hidden-charges/index.js";
import { SITE_SETTING } from "../plugins/site/index.js";
import { buildFuelPage, LITRE_PARTS } from "./fuel-page.js";

function week(date: string, ttc: number, oil: number, refine: number, excise: number, vat: number, es: number): Observation[] {
  const id = (c: string, p: Parameters<typeof fuelSeriesId>[2]) => fuelSeriesId(c, "diesel", p);
  return [
    { seriesId: id("FR", FUEL_PART.ttc), date, value: ttc }, { seriesId: OIL_SERIES.brentEurPerLitreWeekly, date, value: oil },
    { seriesId: id("FR", FUEL_PART.margin), date, value: refine }, { seriesId: id("FR", FUEL_PART.excise), date, value: excise },
    { seriesId: id("FR", FUEL_PART.vat), date, value: vat }, { seriesId: id("ES", FUEL_PART.ttc), date, value: es },
  ];
}

function fakeBase(neighbours: string[]): SiteReader {
  const obs: Observation[] = [
    ...week("2008-07-07", 1.43, 0.54, 0.23, 0.43, 0.23, 1.2), ...week("2026-11-09", 2.18, 0.56, 0.65, 0.61, 0.36, 1.9),
    { seriesId: OIL_SERIES.brentUsd, date: "2008-07-03", value: 144 }, { seriesId: OIL_SERIES.brentUsd, date: "2026-11-06", value: 97 },
    { seriesId: OIL_SERIES.eurusd, date: "2008-07-03", value: 1.57 }, { seriesId: OIL_SERIES.eurusd, date: "2026-11-09", value: 1.10 },
    { seriesId: OIL_SERIES.eurusd, date: "2026-11-12", value: 9 },   // après la date des prix : ignorée
    { seriesId: chargeSeriesId("cee"), date: "2026-09-11", value: 0.1657 },
  ];
  const settings: Record<string, unknown> = {
    [SITE_SETTING.fuelPage]: { country: "FR", products: ["diesel"], historyFrom: "2008-01-01", neighbours,
      reference: { label: "Juillet 2008", from: "2008-07-01", to: "2008-07-31" } },
    [FUEL_CATALOG_SETTING]: { products: [{ id: "diesel", label: "Gazole", bulletinCode: "diesel", vatColumnLabel: "x" }],
      countries: [{ code: "FR", label: "France" }, { code: "ES", label: "Espagne" }] },
    [HIDDEN_CHARGES_SETTING]: ["cee", "biofuel"],
  };
  const series: Record<string, SeriesDecl> = Object.fromEntries(["cee", "biofuel"].map((id) => [chargeSeriesId(id),
    { id: chargeSeriesId(id), label: id.toUpperCase(), description: `à propos de ${id}`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.onChange, sourceId: chargeSourceId(id) }]));
  const sources: Record<string, SourceDecl> = Object.fromEntries(["cee", "biofuel"].map((id) => [chargeSourceId(id),
    { id: chargeSourceId(id), name: `source ${id}`, publisher: "p", url: `https://exemple/${id}`, licence: "l" }]));
  return {
    get: (s) => obs.filter((o) => o.seriesId === s).sort((a, b) => a.date.localeCompare(b.date)),
    ids: () => [],
    series: (id) => series[id] ?? null,
    source: (id) => sources[id] ?? null,
    setting: (k) => { if (!(k in settings)) throw new Error(`réglage absent : ${k}`); return settings[k]; },
    settingOrNull: (k) => settings[k] ?? null,
  };
}

test("page carburants : tout vient de la base (séries, réglages, sources)", () => {
  const page = buildFuelPage(fakeBase(["ES"]));
  assert.equal(page.asOf, "2026-11-09");
  const p = page.products[0]!;
  assert.equal(p.litre, 2.18);
  assert.deepEqual(p.now, { oil: 0.56, refine: 0.65, excise: 0.61, vat: 0.36 });
  assert.equal(p.reference.oil, 0.54);
  assert.deepEqual(p.neighbours, [{ code: "ES", label: "Espagne", litre: 1.9 }]);
  assert.deepEqual(p.annual.map((a) => a.year), [2008, 2026]);
  assert.deepEqual(p.quarterly.map((q) => [q.year, q.quarter]), [[2008, 3], [2026, 4]]);
  assert.deepEqual(page.market, { brentUsd: { reference: 144, now: 97 }, usdPerEur: { reference: 1.57, now: 1.10 } });
  assert.ok(Math.abs(LITRE_PARTS.reduce((s, k) => s + p.now[k], 0) - p.litre) < 1e-9);   // les parts refont le prix
  assert.equal(page.stations, null, "plugin stations absent : pas de bloc, pas d'erreur");
});

test("charges cachées : relevé daté avec sa source ; sans valeur en base = non publié", () => {
  const [cee, bio] = buildFuelPage(fakeBase(["ES"])).hiddenCharges;
  assert.deepEqual(cee, { id: "cee", label: "CEE", description: "à propos de cee", eurPerLitre: 0.1657, asOf: "2026-09-11",
    source: { name: "source cee", url: "https://exemple/cee" } });
  assert.equal(bio!.eurPerLitre, null);
  assert.equal(bio!.asOf, null);
});

test("charges cachées : un montant négatif est refusé à l'entrée, null (non publié) accepté", () => {
  const ok = { id: "x", label: "x", description: "x", asOf: "2026-01-01", source: { name: "s", url: "u" } };
  assert.equal(parseHiddenCharges({ charges: [{ ...ok, eurPerLitre: null }] })[0]!.eurPerLitre, null);
  assert.throws(() => parseHiddenCharges({ charges: [{ ...ok, eurPerLitre: -1 }] }), /positif ou null/);
});

test("un voisin sans prix à la date est une erreur, pas une carte vide", () => {
  assert.throws(() => buildFuelPage(fakeBase(["DE"])), /pas de prix diesel pour DE/);
});
