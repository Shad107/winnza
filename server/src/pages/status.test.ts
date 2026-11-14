import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store.js";
import { buildStatus, redact } from "./status.js";

test("état : messages sans secret, collectes et déploiement lus", () => {
  assert.equal(redact("HTTP 400 sur https://x/api?key=AIzaSyD-abc123&q=1"), "HTTP 400 sur https://x/api?key=***&q=1");
  assert.equal(redact("clé sk-ant-api03-AbCdEf123456 refusée"), "clé *** refusée");
  assert.equal(redact("jeton ya29.a0AfB_byC1234567890abcdefghijklmnopqrstuvwxyzABCDEF expiré"), "jeton ya29.*** expiré");
  const store = new Store(":memory:");
  store.recordRun({ startedAt: "2026-11-14T06:30:00Z", ok: true, observations: 10, message: null, warnings: ["keywords : token=abcdef expiré"] });
  const s = buildStatus(store, "4428088abc ok\n", ["villes : pas de relevé"]);
  assert.deepEqual(s.collects[0]!.warnings, ["keywords : token=*** expiré"]);
  assert.deepEqual(s.deploy, { commit: "4428088abc", result: "ok" });
  assert.equal(s.freshness.find((f) => f.what.startsWith("Brent"))!.latest, null);
  assert.deepEqual(buildStatus(store, null, []).deploy, null);
});
