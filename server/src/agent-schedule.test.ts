// L'IA du site ne passe que le jour de publication déclaré (publishDay de declarations/agent.json). Ce test
// vérifie la déclaration ET son appel : un jour déclaré que le script ne lit plus remettrait un passage par jour
// (dépense et compte rendu quotidiens) sans que rien ne casse.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "..");

/** le script s'arrête-t-il, hors du jour déclaré, AVANT de lancer l'agent ? */
export const guardsPublishDay = (script: string): boolean => {
  const read = script.search(/\["publishDay"\]/);
  const exit = script.search(/if \[ "\$\(date \+%u\)" != "\$PUBLISH_DAY" \]; then\s*\n\s*exit 0/);
  const run = script.search(/agent-run\.sh" "\$LIB\/agent\.json"/);
  return read >= 0 && exit > read && run > exit;
};

const WITH_GUARD = `PUBLISH_DAY=$(python3 -c 'print(c["publishDay"])')\nif [ "$(date +%u)" != "$PUBLISH_DAY" ]; then\n  exit 0\nfi\nsudo bash "$LIB/agent-run.sh" "$LIB/agent.json"`;

test("jour de publication : le contrôle sait échouer (témoin)", () => {
  assert.equal(guardsPublishDay(WITH_GUARD), true);
  assert.equal(guardsPublishDay(`sudo bash "$LIB/agent-run.sh" "$LIB/agent.json"`), false);
  // garde placée après le lancement : trop tard, l'agent a déjà tourné
  const late = `sudo bash "$LIB/agent-run.sh" "$LIB/agent.json"\n` + WITH_GUARD.split("\nsudo")[0];
  assert.equal(guardsPublishDay(late), false);
});

test("jour de publication : déclaré (1 à 7) et appliqué par agent-cron.sh avant le passage", () => {
  const decl = JSON.parse(readFileSync(join(ROOT, "declarations/agent.json"), "utf8")) as { publishDay?: unknown };
  assert.ok(Number.isInteger(decl.publishDay) && (decl.publishDay as number) >= 1 && (decl.publishDay as number) <= 7, "publishDay doit valoir 1 (lundi) à 7 (dimanche)");
  assert.equal(guardsPublishDay(readFileSync(join(ROOT, "scripts/agent-cron.sh"), "utf8")), true);
});
