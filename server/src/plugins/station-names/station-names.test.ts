import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOverpass } from "./index.js";

test("noms : nom d'usage, sinon enseigne ; plusieurs identifiants ; sans nom ni identifiant, écarté", () => {
  const items = parseOverpass(JSON.stringify({ elements: [
    { tags: { name: "Carrefour Market", brand: "Carrefour", "ref:FR:prix-carburants": "35000001" } },
    { tags: { brand: "TotalEnergies", "ref:FR:prix-carburants": "35000002;35000003" } },
    { tags: { "ref:FR:prix-carburants": "35000004" } },
    { tags: { name: "Sans identifiant" } },
  ] }));
  assert.deepEqual(items, [
    { key: "35000001", value: { name: "Carrefour Market" } },
    { key: "35000002", value: { name: "TotalEnergies" } },
    { key: "35000003", value: { name: "TotalEnergies" } },
  ]);
});

test("noms : page d'erreur d'un serveur saturé refusée (la collecte garde alors les derniers noms)", () => {
  assert.throws(() => parseOverpass("# 502 Gateway Timeout\nThis Overpass API server is currently at capacity."), /pas du JSON/);
});
