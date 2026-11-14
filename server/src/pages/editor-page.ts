// Données de la page d'administration de l'IA : les dernières propositions, ce qui est déjà validé, et la
// dépense du mois. Calculées depuis la base seulement.
import type { CollectReader } from "../contract.js";
import { EDITOR_BLOCKED_SETTING, EDITOR_OVERRIDES_SETTING, EDITOR_PUBLISH_SETTING, EDITOR_SNAPSHOT, liveOverrides, parseBlocked, parseOverrides, PUBLISH, RUN_KEY, spentThisMonth, type EditorRun, type Override, type Proposal } from "../plugins/editor/model.js";

export type EditorPage = {
  date: string | null; run: EditorRun | null; spentThisMonth: number; proposals: Proposal[];
  /** publication automatique (sinon : validation à la main) */
  auto: boolean;
  /** validés à la main */
  overrides: Record<string, Override>;
  /** ce qui est réellement en ligne */
  live: Record<string, Override>;
  blocked: string[];
};

export function buildEditorPage(read: CollectReader, today: string): EditorPage {
  const date = read.snapshotDates(EDITOR_SNAPSHOT).at(-1) ?? null;
  const items = date ? read.snapshot(EDITOR_SNAPSHOT, date) : [];
  return {
    date, run: (items.find((i) => i.key === RUN_KEY)?.value as EditorRun | undefined) ?? null,
    spentThisMonth: spentThisMonth(read, today),
    proposals: items.filter((i) => i.key !== RUN_KEY).map((i) => i.value as Proposal),
    auto: read.settingOrNull(EDITOR_PUBLISH_SETTING) === PUBLISH.auto,
    overrides: parseOverrides(read.settingOrNull(EDITOR_OVERRIDES_SETTING)),
    live: liveOverrides(read),
    blocked: parseBlocked(read.settingOrNull(EDITOR_BLOCKED_SETTING)),
  };
}

/** Valide une proposition : seulement si elle existe dans le dernier relevé et qu'aucun contrôle n'a échoué. */
export function approve(page: EditorPage, path: string, today: string): Record<string, Override> {
  const p = page.proposals.find((x) => x.path === path);
  if (!p) throw new Error(`aucune proposition pour ${path}`);
  if (p.problems.length) throw new Error(`proposition refusée par les contrôles : ${p.problems.join(" ; ")}`);
  return { ...page.overrides, [path]: { title: p.proposed.title, description: p.proposed.description, approvedOn: today } };
}

/** Bloque une page (elle garde son titre d'origine) ou la débloque. */
export const setBlocked = (page: EditorPage, path: string, blocked: boolean): string[] =>
  blocked ? [...new Set([...page.blocked, path])] : page.blocked.filter((p) => p !== path);
