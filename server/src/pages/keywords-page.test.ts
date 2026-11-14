import { test } from "node:test";
import assert from "node:assert/strict";
import type { SiteReader, SnapshotItem } from "../contract.js";
import { KEYWORDS_SETTING, KEYWORDS_SNAPSHOT } from "../plugins/keywords/index.js";
import { buildKeywordsPage } from "./keywords-page.js";

const groups = [{ id: "plein", page: "/", label: "Le plein", seeds: ["prix essence"] }];
const idea = (text: string, volume: number, months: number[]) => ({ group: "plein", text, volume, competition: "LOW", seed: false,
  months: months.map((searches, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, searches })) });
const reader = (date: string | null, items: SnapshotItem[]): SiteReader => ({
  get: () => [], ids: () => [], series: () => null, source: () => null,
  setting: (k) => (k === KEYWORDS_SETTING ? groups : null), settingOrNull: (k) => (k === KEYWORDS_SETTING ? groups : null),
  snapshotDates: (id) => (id === KEYWORDS_SNAPSHOT && date ? [date] : []), snapshot: () => items,
});

test("mots-clés : du plus cherché au moins cherché, tendance du dernier mois, relevé ancien signalé", () => {
  const items = [{ key: "plein|a", value: idea("a", 100, [100, 100, 150]) }, { key: "plein|b", value: idea("b", 900, []) }];
  const page = buildKeywordsPage(reader("2026-11-14", items), "2026-11-14")!;
  assert.deepEqual(page.groups[0]!.ideas.map((i) => i.text), ["b", "a"]);
  assert.equal(page.groups[0]!.total, 1000);
  assert.ok(Math.abs(page.groups[0]!.ideas[1]!.trend! - (150 / (350 / 3) - 1)) < 1e-9);
  assert.equal(page.groups[0]!.ideas[0]!.trend, null, "sans historique, pas de tendance inventée");
  assert.equal(page.stale, false);
  assert.equal(buildKeywordsPage(reader("2026-11-05", items), "2026-11-14")!.stale, true, "relevé de 9 jours : jeton sans doute expiré");
  assert.equal(buildKeywordsPage(reader(null, []), "2026-11-14"), null);
});
