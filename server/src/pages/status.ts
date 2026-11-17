// L'état de santé du site, publié en JSON (/etat.json) : ce qu'un agent de maintenance, ou un humain, doit
// savoir pour réparer. Aucun secret : les messages passent par `redact`, et rien ne vient des fichiers de
// configuration du serveur.
import type { SiteReader } from "../contract.js";
import type { Store } from "../store.js";
import { KEYWORDS_SNAPSHOT } from "../plugins/keywords/index.js";
import { SEARCH_CONSOLE_SNAPSHOT } from "../plugins/search-console/index.js";

/** Masque ce qui pourrait ressembler à un secret dans un message d'erreur (paramètre de clé, jeton long). */
export function redact(msg: string): string {
  return msg
    .replace(/((?:key|token|secret|password|apikey|api_key)=)[^&\s"]+/gi, "$1***")
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "***")
    .replace(/\b[A-Za-z0-9_\-/+]{40,}\b/g, "***");
}

/** Une donnée et la date de son dernier relevé : une date qui ne bouge plus signale une source cassée. */
export type Freshness = { what: string; latest: string | null };
export type Status = {
  generatedAt: string;
  collects: { startedAt: string; finishedAt: string | null; ok: boolean; observations: number; message: string | null; warnings: string[] }[];
  deploy: { commit: string; result: string } | null;
  freshness: Freshness[];
};

export function buildStatus(store: Store & SiteReader, deployState: string | null): Status {
  const snap = (what: string, id: string): Freshness => ({ what, latest: store.snapshotDates(id).at(-1) ?? null });
  const [commit, result] = (deployState ?? "").trim().split(/\s+/, 2);
  return {
    generatedAt: new Date().toISOString(),
    collects: store.recentRuns(10).map((r) => ({ ...r, message: r.message && redact(r.message), warnings: r.warnings.map(redact) })),
    deploy: commit ? { commit, result: result ?? "" } : null,
    freshness: [
      snap("mots-clés (Keyword Planner)", KEYWORDS_SNAPSHOT),
      snap("recherches Google (Search Console)", SEARCH_CONSOLE_SNAPSHOT),
    ],
  };
}
