import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Observation, SeriesReader } from "../contract.js";
import { checkArticle, parseArticle, resolveArticle } from "./articles.js";

const GOOD = `---
title: Le gazole recule pour la deuxième semaine
description: Ce qui a bougé cette semaine à la pompe, d'après les prix relevés chaque jour dans toutes les stations.
date: 2026-11-16
---
Le gazole valait {{station.FR.gazole.avg@2026-11-16|eur3}} en moyenne, soit {{station.FR.gazole.avg@2026-11-09..2026-11-16|ct}} en une semaine.
En 2022, année de crise, tout était différent.`;

const obs = (pairs: [string, number][]): Observation[] => pairs.map(([date, value]) => ({ seriesId: "station.FR.gazole.avg", date, value }));
const reader = (o: Observation[]): SeriesReader => ({ get: (id) => (id === "station.FR.gazole.avg" ? o : []), ids: () => [] });

test("analyse : un article conforme passe, ses jetons sont remplacés par les valeurs de la base", () => {
  const a = parseArticle("2026-11-16-gazole-recule", GOOD);
  assert.deepEqual(checkArticle(a), []);
  const r = resolveArticle(a, reader(obs([["2026-11-09", 2.15], ["2026-11-16", 2.112]])));
  assert.deepEqual(r.missing, []);
  assert.match(r.markdown, /valait 2,112\s€ en moyenne, soit −4 centimes en une semaine/);
});

test("analyse : chiffre tapé à la main, jeton mal formé ou trop tardif, HTML, tiret cadratin : refusés", () => {
  const bad = (body: string) => checkArticle({ ...parseArticle("2026-11-16-x", GOOD), body }).join(" | ");
  assert.match(bad("Le gazole vaut 2,11 € ce matin."), /chiffre écrit à la main/);
  assert.match(bad("Il a pris 3 % en un mois."), /chiffre écrit à la main/);
  assert.match(bad("{{station.FR.gazole.avg@2026-11-16|eur9}}"), /format « eur9 »/);
  assert.match(bad("{{station.FR.gazole.avg@2026-11-20|eur3}}"), /après celle de l'article/);
  assert.match(bad("{{station FR}}"), /jeton mal formé/);
  assert.match(bad("<script>x</script>"), /HTML brut/);
  assert.match(bad("Un recul — net."), /tiret/);
  assert.match(checkArticle({ ...parseArticle("2026-11-16-x", GOOD), slug: "Gazole" }).join(), /nom de fichier/);
  assert.throws(() => parseArticle("x", "pas d'en-tête"), /en-tête/);
});

test("analyse : une donnée absente de la base s'affiche comme indisponible, et c'est signalé", () => {
  const r = resolveArticle(parseArticle("2026-11-16-x", GOOD), reader([]));
  assert.equal(r.missing.length, 2);
  assert.match(r.markdown, /\(donnée indisponible\)/);
});

// Chaque analyse du dépôt passe les règles : c'est ce contrôle qui protège le site des articles de l'IA.
test("analyses du dépôt : toutes conformes", () => {
  const dir = join(import.meta.dirname, "../../../content/analyses");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const problems = checkArticle(parseArticle(f.replace(/\.md$/, ""), readFileSync(join(dir, f), "utf8")));
    assert.deepEqual(problems, [], `${f} : ${problems.join(" ; ")}`);
  }
});
