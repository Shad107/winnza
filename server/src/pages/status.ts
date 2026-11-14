// L'état de santé du site, publié en JSON (/etat.json) : ce qu'un agent de maintenance, ou un humain, doit
// savoir pour réparer. Aucun secret : les messages passent par `redact`, et rien ne vient des fichiers de
// configuration du serveur.
import type { SiteReader } from "../contract.js";
import type { Store } from "../store.js";
import { OIL_SERIES, FUEL_PART, fuelSeriesId } from "../plugins/fuel/series-ids.js";
import { AREA_FRANCE, STATIONS_SNAPSHOT, stationSeriesId } from "../plugins/stations/index.js";
import { STATION_NAMES_SNAPSHOT } from "../plugins/station-names/index.js";
import { TEMPO_SERIES, wholesaleSeriesId } from "../plugins/electricity/series-ids.js";
import { KEYWORDS_SNAPSHOT } from "../plugins/keywords/index.js";
import { EDITOR_SNAPSHOT } from "../plugins/editor/model.js";

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
  /** pages optionnelles retirées faute de données valables (voir web/src/lib/server/data.ts) */
  pageErrors: string[];
};

export function buildStatus(store: Store & SiteReader, deployState: string | null, pageErrors: readonly string[]): Status {
  const series = (what: string, id: string): Freshness => ({ what, latest: store.get(id).at(-1)?.date ?? null });
  const snap = (what: string, id: string): Freshness => ({ what, latest: store.snapshotDates(id).at(-1) ?? null });
  const [commit, result] = (deployState ?? "").trim().split(/\s+/, 2);
  return {
    generatedAt: new Date().toISOString(),
    collects: store.recentRuns(10).map((r) => ({ ...r, message: r.message && redact(r.message), warnings: r.warnings.map(redact) })),
    deploy: commit ? { commit, result: result ?? "" } : null,
    freshness: [
      series("prix à la pompe, bulletin européen (hebdomadaire)", fuelSeriesId("FR", "diesel", FUEL_PART.ttc)),
      series("Brent", OIL_SERIES.brentUsd),
      series("moyenne des stations, France", stationSeriesId(AREA_FRANCE, "gazole", "avg")),
      snap("relevé des stations", STATIONS_SNAPSHOT),
      snap("noms des stations (OpenStreetMap)", STATION_NAMES_SNAPSHOT),
      series("prix de gros de l'électricité", wholesaleSeriesId("FR")),
      series("couleur Tempo", TEMPO_SERIES),
      snap("mots-clés (Keyword Planner)", KEYWORDS_SNAPSHOT),
      snap("propositions de l'IA rédactrice", EDITOR_SNAPSHOT),
    ],
    pageErrors: [...pageErrors].map(redact),
  };
}
