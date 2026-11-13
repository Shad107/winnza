import { test } from "node:test";
import assert from "node:assert/strict";
import type { Observation, SeriesReader } from "../../contract.js";
import type { Row, Workbook } from "../../xlsx.js";
import { deriveBrentEurPerLitre, deriveDecomposition, deriveWeeklyCrude } from "./derive.js";
import { BULLETIN_SHEET, parseBulletinPrices, parseBulletinVat, parseEcbCsv, parseFredCsv } from "./parse.js";
import { FUEL_PART, fuelSeriesId, OIL_SERIES } from "./series-ids.js";

const FR = [{ code: "FR", label: "France" }];
const DIESEL = [{ id: "diesel", label: "Gazole", bulletinCode: "diesel", vatColumnLabel: "Gas oil automobile" }];
const row = (cells: Record<string, string | number>): Row => new Map(Object.entries(cells));

// 44459 = 2021-09-20 en date Excel ; 41640 = 2014-01-01 ; 36617 = 2000-04-01
const book: Workbook = new Map([
  [BULLETIN_SHEET.withTax, [row({ A: "Consumer prices", CO: "FR_price_with_tax_diesel" }), row({ A: "Date", CO: "1000 l" }), row({ A: 44459, CO: 1450 })]],
  [BULLETIN_SHEET.withoutTax, [row({ CO: "FR_price_wo_tax_diesel" }), row({ A: 44459, CO: 600 })]],
  [BULLETIN_SHEET.vat, [row({ B: "Since:", D: "Gas oil automobile Automotive gas oil" }), row({ A: "FR_", B: 41640, D: 20 }), row({ B: 36617, D: 19.6 }), row({ A: "GR_", B: 42522, D: 24 })]],
]);

function reader(obs: Observation[]): SeriesReader {
  return {
    get: (id) => obs.filter((o) => o.seriesId === id).sort((a, b) => a.date.localeCompare(b.date)),
    ids: (p) => [...new Set(obs.map((o) => o.seriesId).filter((i) => i.startsWith(p)))],
  };
}

test("bulletin : lit le TTC par code de colonne, en euros par litre", () => {
  assert.deepEqual(parseBulletinPrices(book, true, FR, DIESEL), [{ seriesId: "fuel.FR.diesel.ttc", date: "2021-09-20", value: 1.45 }]);
});

test("bulletin : une colonne déclarée absente est une erreur, pas un trou silencieux", () => {
  assert.throws(() => parseBulletinPrices(book, true, [{ code: "XX", label: "?" }], DIESEL), /XX_price_with_tax_diesel/);
});

test("bulletin : TVA lue par bloc de pays, sans déborder sur le pays suivant", () => {
  const vat = parseBulletinVat(book, FR, DIESEL);
  assert.deepEqual(vat.map((o) => [o.date, o.value]), [["2014-01-01", 20], ["2000-04-01", 19.6]]);
});

test("FRED et BCE : jours sans cotation ignorés, colonnes BCE repérées par leur nom", () => {
  assert.deepEqual(parseFredCsv("observation_date,DCOILBRENTEU\n2008-07-03,143.95\n2008-07-04,.\n"), [{ seriesId: OIL_SERIES.brentUsd, date: "2008-07-03", value: 143.95 }]);
  const ecb = "KEY,FREQ,TIME_PERIOD,OBS_VALUE\nEXR.D.USD.EUR.SP00.A,D,2008-07-15,1.599\n";
  assert.deepEqual(parseEcbCsv(ecb), [{ seriesId: OIL_SERIES.eurusd, date: "2008-07-15", value: 1.599 }]);
});

test("décomposition : retrouve celle de la Banque de France pour septembre 2021 (accise 0,61, TVA 0,24)", () => {
  const obs: Observation[] = [
    ...parseBulletinPrices(book, true, FR, DIESEL), ...parseBulletinPrices(book, false, FR, DIESEL), ...parseBulletinVat(book, FR, DIESEL),
    { seriesId: OIL_SERIES.brentEurPerLitreWeekly, date: "2021-09-20", value: 0.39 },
  ];
  const d = deriveDecomposition(reader(obs), FR, DIESEL);
  const v = (part: Parameters<typeof fuelSeriesId>[2]) => d.find((o) => o.seriesId === fuelSeriesId("FR", "diesel", part))!.value;
  assert.ok(Math.abs(v(FUEL_PART.vat) - 0.2417) < 0.001);
  assert.ok(Math.abs(v(FUEL_PART.excise) - 0.6083) < 0.001);
  assert.ok(Math.abs(v(FUEL_PART.margin) - 0.21) < 1e-9);
  // les trois parts et le brut refont le prix payé
  assert.ok(Math.abs(v(FUEL_PART.vat) + v(FUEL_PART.excise) + v(FUEL_PART.margin) + 0.39 - 1.45) < 1e-9);
});

test("brut : baril en dollars ramené au litre en euros, puis moyenne des 7 jours AVANT le relevé", () => {
  const obs: Observation[] = [
    { seriesId: OIL_SERIES.brentUsd, date: "2021-09-13", value: 158.987294928 },
    { seriesId: OIL_SERIES.eurusd, date: "2021-09-13", value: 1 },
    { seriesId: OIL_SERIES.brentUsd, date: "2021-09-20", value: 999 },   // jour du relevé : exclu
    { seriesId: OIL_SERIES.eurusd, date: "2021-09-20", value: 1 },
    { seriesId: "ref", date: "2021-09-20", value: 0 },
  ];
  const daily = deriveBrentEurPerLitre(reader(obs));
  assert.equal(daily[0]!.value, 1);
  const weekly = deriveWeeklyCrude(reader([...obs, ...daily]), "ref");
  assert.deepEqual(weekly, [{ seriesId: OIL_SERIES.brentEurPerLitreWeekly, date: "2021-09-20", value: 1 }]);
});
