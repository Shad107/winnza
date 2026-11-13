import { test } from "node:test";
import assert from "node:assert/strict";
import type { Observation, SeriesReader } from "../../contract.js";
import { FUEL_PART, fuelSeriesId, OIL_SERIES } from "../fuel/series-ids.js";
import { deriveRefinedEur, deriveSignals, parseForecastDecl, refinedEurId, refinedUsdId, signalId, weeklySignal, LITRES_PER_US_GALLON } from "./index.js";

const decl = parseForecastDecl({ source: { id: "f", name: "n", publisher: "p", url: "https://exemple/csv", licence: "l" }, country: "FR",
  products: [{ product: "diesel", fredSeries: "DDFUELUSGULF", label: "Gazole" }], windowDays: 2, threshold: 0.01, stableMove: 0.003, trackSince: "2026-01-01" });
const reader = (obs: Observation[]): SeriesReader => ({ get: (id) => obs.filter((o) => o.seriesId === id).sort((a, b) => a.date.localeCompare(b.date)), ids: () => [] });

test("produit raffiné : dollars par gallon convertis en euros par litre au cours du jour", () => {
  const out = deriveRefinedEur(reader([{ seriesId: refinedUsdId("diesel"), date: "2026-01-05", value: LITRES_PER_US_GALLON * 2 },
    { seriesId: OIL_SERIES.eurusd, date: "2026-01-05", value: 2 }, { seriesId: refinedUsdId("diesel"), date: "2026-01-06", value: 9 }]), "diesel");
  assert.deepEqual(out, [{ seriesId: refinedEurId("diesel"), date: "2026-01-05", value: 1 }], "un jour sans cours de change : pas de valeur");
});

test("signal : moyenne des derniers jours AVANT la date, moins celle d'une semaine plus tôt", () => {
  const ser = ["2026-01-01", "2026-01-02", "2026-01-08", "2026-01-09"].map((d, i) => ({ seriesId: "r", date: d, value: [1, 1, 1.1, 1.1][i]! }));
  assert.ok(Math.abs(weeklySignal(ser, "2026-01-10", 2)! - 0.1) < 1e-9);
  assert.equal(weeklySignal(ser, "2026-01-03", 2), null, "pas assez d'historique : pas de signal");
});

test("prévision : un signal à chaque relevé, plus celui de la semaine qui vient", () => {
  const refined = ["2026-01-01", "2026-01-02", "2026-01-08", "2026-01-09", "2026-01-15", "2026-01-16"].map((d, i) => ({ seriesId: refinedEurId("diesel"), date: d, value: 1 + i * 0.01 }));
  const ttc = [{ seriesId: fuelSeriesId("FR", "diesel", FUEL_PART.ttc), date: "2026-01-12", value: 2 }];
  const sigs = deriveSignals(reader([...refined, ...ttc]), decl, "diesel");
  assert.deepEqual(sigs.map((s) => s.date), ["2026-01-12", "2026-01-17"]);
  assert.ok(sigs.every((s) => s.seriesId === signalId("diesel") && s.value > 0));
});

test("réglages : une série FRED qui n'est pas un identifiant simple est refusée (elle entre dans une adresse)", () => {
  assert.throws(() => parseForecastDecl({ ...decl, products: [{ product: "x", fredSeries: "A&B", label: "x" }] }), /série FRED invalide/);
});
