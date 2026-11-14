import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store.js";
import { EDITOR_BLOCKED_SETTING, EDITOR_OVERRIDES_SETTING, EDITOR_PUBLISH_SETTING, EDITOR_SNAPSHOT, liveOverrides, PUBLISH, RUN_KEY, type Proposal } from "../plugins/editor/model.js";

const prop = (path: string, problems: string[] = []): Proposal => ({ path, label: path, current: { title: "a", description: "b" },
  proposed: { title: `IA ${path}`, description: "d" }, keywords: [], reason: "", problems, runId: "r" });
function store(publish: string): Store {
  const s = new Store(":memory:");
  s.putSetting(EDITOR_PUBLISH_SETTING, publish);
  s.putSnapshot(EDITOR_SNAPSHOT, { date: "2026-11-14", items: [
    { key: RUN_KEY, value: { runId: "r", date: "2026-11-14", model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0.1 } },
    { key: "/", value: prop("/") }, { key: "/taxes", value: prop("/taxes", ["tiret cadratin"]) }, { key: "/europe", value: prop("/europe") },
  ] }, 120);
  return s;
}

test("mode automatique : les propositions contrôlées sont en ligne, pas les refusées ; une page bloquée garde son titre", () => {
  const s = store(PUBLISH.auto);
  assert.deepEqual(Object.keys(liveOverrides(s)).sort(), ["/", "/europe"]);
  s.putSetting(EDITOR_BLOCKED_SETTING, ["/europe"]);
  assert.deepEqual(Object.keys(liveOverrides(s)), ["/"]);
  // une validation à la main l'emporte sur la proposition du jour
  s.putSetting(EDITOR_OVERRIDES_SETTING, { "/": { title: "À la main", description: "d", approvedOn: "2026-11-10" } });
  assert.equal(liveOverrides(s)["/"]!.title, "À la main");
});

// Témoin : en mode validation, rien ne part en ligne sans clic.
test("mode validation : aucune proposition en ligne sans validation", () => {
  assert.deepEqual(liveOverrides(store(PUBLISH.review)), {});
});
