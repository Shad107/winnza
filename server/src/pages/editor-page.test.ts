import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store.js";
import { EDITOR_OVERRIDES_SETTING, EDITOR_SNAPSHOT, parseOverrides, RUN_KEY, type Proposal } from "../plugins/editor/model.js";
import { approve, buildEditorPage } from "./editor-page.js";

const prop = (path: string, problems: string[] = []): Proposal => ({ path, label: path, current: { title: "a", description: "b" },
  proposed: { title: `Titre ${path}`, description: "Une description" }, keywords: [], reason: "", problems, runId: "r" });

test("validation : seulement une proposition sans problème ; un titre validé mal formé est une erreur", () => {
  const store = new Store(":memory:");
  store.putSnapshot(EDITOR_SNAPSHOT, { date: "2026-11-14", items: [
    { key: RUN_KEY, value: { runId: "r", date: "2026-11-14", model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0.5 } },
    { key: "/", value: prop("/") }, { key: "/taxes", value: prop("/taxes", ["tiret cadratin"]) },
  ] }, 120);
  const page = buildEditorPage(store, "2026-11-14");
  assert.equal(page.spentThisMonth, 0.5);
  assert.deepEqual(approve(page, "/", "2026-11-14"), { "/": { title: "Titre /", description: "Une description", approvedOn: "2026-11-14" } });
  assert.throws(() => approve(page, "/taxes", "2026-11-14"), /tiret cadratin/);
  assert.throws(() => approve(page, "/inconnue", "2026-11-14"), /aucune proposition/);
  store.putSetting(EDITOR_OVERRIDES_SETTING, { "/": { title: "" } });
  assert.throws(() => buildEditorPage(store, "2026-11-14"), /« title » manquant/);
  assert.deepEqual(parseOverrides(null), {});
});
