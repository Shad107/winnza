// Règles d'écriture valables pour tout le dépôt (CLAUDE.md) : aucun tiret cadratin ni demi-cadratin, dans
// aucun fichier suivi par git. Un test qui en a besoin l'écrit en séquence d'échappement (—).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "..");
/** hors d'un dépôt git (construction Docker, sans .git) la liste des fichiers suivis n'existe pas : ce test-là
 *  est alors sauté, et c'est l'intégration continue, qui a le dépôt complet, qui l'exécute */
const IN_REPO = (() => { try { execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: ROOT, stdio: "ignore" }); return true; } catch { return false; } })();
const DASH = /[–—]/;
/** les fichiers binaires ne contiennent pas de texte à relire */
const BINARY = /\.(jpe?g|png|gif|webp|ico|woff2?|ttf|otf|pdf)$/i;

/** les lignes fautives d'un texte, « fichier:ligne » */
export const dashLines = (file: string, text: string): string[] =>
  text.split("\n").flatMap((l, i) => (DASH.test(l) ? [`${file}:${i + 1}`] : []));

test("tirets : le contrôle sait échouer (témoin)", () => {
  assert.deepEqual(dashLines("a.md", "ligne\nune incise — ici\nfin – ok"), ["a.md:2", "a.md:3"]);
  assert.deepEqual(dashLines("a.md", "un tiret court - permis"), []);
});

test("tirets : aucun cadratin ni demi-cadratin dans les fichiers suivis du dépôt", { skip: !IN_REPO && "pas de dépôt git ici (construction Docker)" }, () => {
  const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter((f) => f && !BINARY.test(f));
  assert.deepEqual(files.flatMap((f) => { try { return dashLines(f, readFileSync(join(ROOT, f), "utf8")); } catch { return []; } }), []);
});
