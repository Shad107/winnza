// Données de la page d'administration de l'IA : les dernières propositions, ce qui est déjà validé, et la
// dépense du mois. Calculées depuis la base seulement.
import type { CollectReader } from "../contract.js";
import { EDITOR_OVERRIDES_SETTING, EDITOR_SNAPSHOT, parseOverrides, RUN_KEY, spentThisMonth, type EditorRun, type Override, type Proposal } from "../plugins/editor/index.js";

export type EditorPage = { date: string | null; run: EditorRun | null; spentThisMonth: number; proposals: Proposal[]; overrides: Record<string, Override> };

export function buildEditorPage(read: CollectReader, today: string): EditorPage {
  const date = read.snapshotDates(EDITOR_SNAPSHOT).at(-1) ?? null;
  const items = date ? read.snapshot(EDITOR_SNAPSHOT, date) : [];
  return {
    date, run: (items.find((i) => i.key === RUN_KEY)?.value as EditorRun | undefined) ?? null,
    spentThisMonth: spentThisMonth(read, today),
    proposals: items.filter((i) => i.key !== RUN_KEY).map((i) => i.value as Proposal),
    overrides: parseOverrides(read.settingOrNull(EDITOR_OVERRIDES_SETTING)),
  };
}

/** Valide une proposition : seulement si elle existe dans le dernier relevé et qu'aucun contrôle n'a échoué. */
export function approve(page: EditorPage, path: string, today: string): Record<string, Override> {
  const p = page.proposals.find((x) => x.path === path);
  if (!p) throw new Error(`aucune proposition pour ${path}`);
  if (p.problems.length) throw new Error(`proposition refusée par les contrôles : ${p.problems.join(" ; ")}`);
  return { ...page.overrides, [path]: { title: p.proposed.title, description: p.proposed.description, approvedOn: today } };
}
