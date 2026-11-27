// Les tests doivent retrouver leurs fichiers dans l'étape de construction Docker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const includesTestInputs = (dockerfile: string): boolean => {
  const build = dockerfile.split(/^FROM /m)[1] ?? "";
  const run = build.search(/^RUN cd server && npm run build && npm test$/m);
  return [/^COPY scripts\/agent-cron\.sh scripts\/$/m, /^COPY Dockerfile \.\/$/m].every(pattern => {
    const copy = build.search(pattern);
    return copy >= 0 && run > copy;
  });
};

const WITH_INPUTS = "FROM node AS build\nCOPY Dockerfile ./\nCOPY scripts/agent-cron.sh scripts/\nRUN cd server && npm run build && npm test\n";

test("Docker : le contrôle des fichiers de test sait échouer (témoins)", () => {
  assert.equal(includesTestInputs(WITH_INPUTS), true);
  for (const copy of ["COPY Dockerfile ./\n", "COPY scripts/agent-cron.sh scripts/\n"]) {
    const missing = WITH_INPUTS.replace(copy, "");
    assert.equal(includesTestInputs(missing), false);
    assert.equal(includesTestInputs(missing + copy), false);
    assert.equal(includesTestInputs(missing + "FROM node\n" + copy), false);
  }
});

test("Docker : les fichiers de test sont copiés avant les tests", () => {
  assert.equal(includesTestInputs(readFileSync(join(process.cwd(), "..", "Dockerfile"), "utf8")), true);
});
