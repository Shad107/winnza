import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry, runCollect } from "../../runner.js";
import { Store } from "../../store.js";
import { NO_POST_NO_SECRET } from "../../test-net.js";
import { electricityPlugin } from "./index.js";
import { buildElectricityPage } from "../../pages/electricity-page.js";
import { parseElecCatalog, parseElecDecl } from "./decl.js";
import { parseTempo, parseTrvCsv, tempoSeason } from "./parse.js";
import { EU_PART, euSeriesId, SUBSCRIPTION, TEMPO_SERIES, TRV_PART, trvSeriesId } from "./series-ids.js";

// la vraie déclaration : les tests portent sur ce qui part en production
const DECL = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../declarations/electricity.json"), "utf8")) as Record<string, unknown>;
const cat = parseElecCatalog(DECL);
const base = cat.trv.options.find((o) => o.id === "base")!;

const BASE_CSV = [
  "DATE_DEBUT;DATE_FIN;P_SOUSCRITE;PART_FIXE_HT;PART_FIXE_TTC;PART_VARIABLE_HT;PART_VARIABLE_TTC",
  "01/02/2026;31/07/2026;6;140,00;186,00;0,1300;0,1928",
  "01/08/2026;;6;143,28;190,81;0,1361;0,2001",
  "01/08/2026;;3;100;130;0,1361;0,2001",
  "01/08/2026;;9;;;;",
].join("\r\n");

test("CRE : colonnes lues par leur nom, puissances non suivies et lignes vides sautées", () => {
  const obs = parseTrvCsv(BASE_CSV, base, cat);
  const v = (period: string, part: typeof TRV_PART.ht | typeof TRV_PART.ttc) => obs.filter((o) => o.seriesId === trvSeriesId("base", 6, period, part)).map((o) => [o.date, o.value]);
  assert.deepEqual(v("kwh", TRV_PART.ttc), [["2026-02-01", 0.1928], ["2026-08-01", 0.2001]]);
  assert.deepEqual(v(SUBSCRIPTION, TRV_PART.ht), [["2026-02-01", 140], ["2026-08-01", 143.28]]);
  assert.ok(!obs.some((o) => o.seriesId.includes(".3kva.")), "3 kVA n'est pas déclarée");
});

test("CRE : colonne disparue, ou deux prix différents le même jour, refusés", () => {
  assert.throws(() => parseTrvCsv(BASE_CSV.replace("PART_VARIABLE_TTC", "PRIX_TTC"), base, cat), /colonne « PART_VARIABLE_TTC » absente/);
  assert.throws(() => parseTrvCsv(BASE_CSV + "\r\n01/08/2026;;6;143,28;190,81;0,1361;0,2002", base, cat), /deux prix différents/);
});

test("Tempo : saison, jour pas encore publié sauté, code inconnu refusé", () => {
  assert.equal(tempoSeason("2026-08-31", 9), "2025-2026");
  assert.equal(tempoSeason("2026-09-01", 9), "2026-2027");
  assert.deepEqual(parseTempo('[{"dateJour":"2026-11-14","codeJour":3},{"dateJour":"2026-11-15","codeJour":0}]', cat), [{ seriesId: TEMPO_SERIES, date: "2026-11-14", value: 3 }]);
  assert.throws(() => parseTempo('[{"dateJour":"2026-11-14","codeJour":4}]', cat), /code de couleur inconnu/);
});

test("déclaration : couleur Tempo inconnue ou pays de référence absent refusés", () => {
  assert.doesNotThrow(() => parseElecDecl(DECL));
  const tempo = { ...(DECL.tempo as object), codes: { "1": "bleu" } };
  assert.throws(() => parseElecCatalog({ ...DECL, tempo }), /couleur inconnue « bleu »/);
  const eurostat = { ...(DECL.eurostat as object), reference: "XX" };
  assert.throws(() => parseElecCatalog({ ...DECL, eurostat }), /référence XX/);
  const page = { consumption: { default: 3700, min: 1000, max: 15000, step: 250 } };
  assert.throws(() => parseElecCatalog({ ...DECL, page }), /pas du curseur/);
});

// --- collecte complète sur de petites réponses fabriquées ---

/** JSON-stat minimal : une dimension par clé de `dims`, valeurs à plat dans l'ordre des dimensions */
function jsonStat(dims: Record<string, string[]>, value: (coords: Record<string, string>) => number | undefined): string {
  const ids = Object.keys(dims), size = ids.map((k) => dims[k]!.length);
  const out: Record<string, number> = {};
  const walk = (j: number, flat: number, coords: Record<string, string>) => {
    if (j === ids.length) { const v = value(coords); if (v !== undefined) out[String(flat)] = v; return; }
    dims[ids[j]!]!.forEach((code, i) => walk(j + 1, flat * size[j]! + i, { ...coords, [ids[j]!]: code }));
  };
  walk(0, 0, {});
  return JSON.stringify({ id: ids, size, value: out,
    dimension: Object.fromEntries(ids.map((k) => [k, { category: { index: Object.fromEntries(dims[k]!.map((c, i) => [c, i])) } }])) });
}

const PARTS = { NRG_SUP: 0.11, NETC: 0.08, TAX_FEE_LEV_CHRG: 0.08, VAT: 0.04 };
/** `vatInsideTaxes` : la rubrique taxes contient la TVA (le vrai format). Sinon : la TVA est à part. */
function fakeNet(opts: { swapHtTtc?: boolean; vatInsideTaxes?: boolean } = {}) {
  const vatInside = opts.vatInsideTaxes ?? true;
  const comp = jsonStat({ nrg_cons: ["KWH2500-4999"], nrg_prc: Object.keys(PARTS), geo: ["FR", "DE"], time: ["2024", "2025"] },
    (c) => PARTS[c.nrg_prc as keyof typeof PARTS]);
  const total = PARTS.NRG_SUP + PARTS.NETC + PARTS.TAX_FEE_LEV_CHRG + (vatInside ? 0 : PARTS.VAT);
  const sem = jsonStat({ nrg_cons: ["KWH2500-4999"], tax: ["I_TAX"], geo: ["FR", "DE"], time: ["2024-S1", "2024-S2", "2025-S1", "2025-S2", "2026-S1"] }, () => total);
  const csv = (header: string, row: string) => `${header}\r\n${row}`;
  const ht = "0,1361", ttc = "0,2001";
  const [a, b] = opts.swapHtTtc ? [ttc, ht] : [ht, ttc];
  const trv: Record<string, string> = {
    Option_Base: csv("DATE_DEBUT;P_SOUSCRITE;PART_FIXE_HT;PART_FIXE_TTC;PART_VARIABLE_HT;PART_VARIABLE_TTC", `01/08/2026;6;143;190;${a};${b}`),
    Option_HPHC: csv("DATE_DEBUT;P_SOUSCRITE;PART_FIXE_HT;PART_FIXE_TTC;PART_VARIABLE_HC_HT;PART_VARIABLE_HC_TTC;PART_VARIABLE_HP_HT;PART_VARIABLE_HP_TTC", "01/08/2026;6;150;200;0,1018;0,1589;0,1479;0,2142"),
    Option_Tempo: csv("DATE_DEBUT;P_SOUSCRITE;PART_FIXE_HT;PART_FIXE_TTC;" + ["HCBleu", "HPBleu", "HCBlanc", "HPBlanc", "HCRouge", "HPRouge"].flatMap((p) => [`PART_VARIABLE_${p}_HT`, `PART_VARIABLE_${p}_TTC`]).join(";"),
      "01/08/2026;6;150;200;0,0824;0,1356;0,1072;0,1654;0,0974;0,1536;0,1295;0,1921;0,1040;0,1615;0,5773;0,7295"),
  };
  const tempoUrls: string[] = [];
  return {
    tempoUrls,
    ...NO_POST_NO_SECRET,
    fetchBytes: async () => new Uint8Array(),
    fetchText: async (url: string) => {
      if (url.includes("nrg_pc_204_c")) return comp;
      if (url.includes("nrg_pc_204")) return sem;
      if (url.includes("joursTempo")) { tempoUrls.push(url); return '[{"dateJour":"2026-11-14","codeJour":1}]'; }
      const k = Object.keys(trv).find((f) => url.includes(f));
      if (!k) throw new Error(`adresse inattendue ${url}`);
      return trv[k]!;
    },
  };
}
const collect = async (store: Store, net: ReturnType<typeof fakeNet>) =>
  runCollect(store, await buildRegistry({ electricity: electricityPlugin }, ["electricity"], () => DECL), net, []);

test("collecte : accise et TVA de chaque prix, taxes hors TVA de chaque pays", async () => {
  const store = new Store(":memory:");
  const net = fakeNet();
  await collect(store, net);
  const near = (id: string, expected: number, why: string) => assert.ok(Math.abs(store.get(id).at(-1)!.value - expected) < 1e-9, `${id} : ${why}`);
  near(trvSeriesId("base", 6, "kwh", TRV_PART.excise), 0.2001 / 1.2 - 0.1361, "accise = TTC / 1,2 - HT");
  near(trvSeriesId("base", 6, "kwh", TRV_PART.vat), 0.2001 - 0.2001 / 1.2, "TVA = TTC - TTC / 1,2");
  near(euSeriesId("FR", EU_PART.taxes), 0.04, "taxes 0,08 dont 0,04 de TVA");
  assert.equal(net.tempoUrls.length, 2, "saison en cours et saison précédente");
  assert.equal(store.get(TEMPO_SERIES).length, 1);
});

// Témoin : HT et TTC inversés dans le fichier, l'accise devient négative, la collecte s'arrête sans rien écrire.
test("HT et TTC inversés : la collecte s'arrête", async () => {
  const store = new Store(":memory:");
  await assert.rejects(collect(store, fakeNet({ swapHtTtc: true })), /hors des bornes/);
  assert.equal(store.get(trvSeriesId("base", 6, "kwh", TRV_PART.ttc)).length, 0);
});

// Témoin : si Eurostat sortait la TVA de la rubrique taxes, notre soustraction serait fausse ; le contrôle le voit.
test("rubrique taxes sans la TVA : la lecture d'Eurostat est refusée", async () => {
  const store = new Store(":memory:");
  await assert.rejects(collect(store, fakeNet({ vatInsideTaxes: false })), /lecture des rubriques Eurostat/);
});

test("page : tarif en vigueur, accise, Europe et Tempo, tout lu en base", async () => {
  const store = new Store(":memory:");
  await collect(store, fakeNet());
  const page = buildElectricityPage(store, "2026-11-14")!;
  const b = page.options.find((o) => o.id === "base")!.powers.find((p) => p.kva === 6)!;
  assert.equal(b.since, "2026-08-01");
  assert.equal(b.subscriptionTtc, 190);
  assert.equal(b.periods[0]!.ttc, 0.2001);
  assert.ok(Math.abs(b.periods[0]!.ht + b.periods[0]!.excise + b.periods[0]!.vat - 0.2001) < 1e-9, "HT + accise + TVA = TTC");
  assert.deepEqual(page.history.months.slice(0, 2), ["2026-08-01", "2026-09-01"], "dès le mois du premier tarif quand il commence le 1er");
  const fr = page.europe.countries.find((c) => c.code === "FR")!;
  assert.deepEqual([page.europe.year, page.europe.semester, fr.price], [2025, "2026-01-01", 0.27]);
  assert.ok(Math.abs(fr.parts!.taxes - 0.04) < 1e-9);
  assert.equal(page.tempo?.color, "blue");
  assert.equal(page.tempo?.used.blue, 1);
  assert.equal(buildElectricityPage(new Store(":memory:")), null, "plugin jamais passé : pas de page");
});
