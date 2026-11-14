// Données de la page d'administration « mots-clés » : le dernier relevé du plugin keywords, par page du
// site, du plus cherché au moins cherché. Calculées depuis la base seulement.
import type { SiteReader } from "../contract.js";
import { KEYWORDS_SETTING, KEYWORDS_SNAPSHOT, type KeywordGroup, type KeywordIdea } from "../plugins/keywords/index.js";
import { addDays } from "../units.js";

/** Au-delà, le relevé est ancien : le jeton Google a sans doute expiré (mode Test, 7 jours). */
export const KEYWORDS_STALE_DAYS = 2;

export type KeywordRow = KeywordIdea & {
  /** dernier mois connu comparé à la moyenne des 12 mois, en fraction (0,25 = +25 %) ; null sans historique */
  trend: number | null;
};
export type KeywordsPage = {
  date: string;
  stale: boolean;
  groups: (KeywordGroup & { total: number; ideas: KeywordRow[] })[];
} | null;

export function buildKeywordsPage(read: SiteReader, today: string): KeywordsPage {
  const groups = read.settingOrNull(KEYWORDS_SETTING) as KeywordGroup[] | null;
  const date = read.snapshotDates(KEYWORDS_SNAPSHOT).at(-1);
  if (!groups || !date) return null;
  const ideas = read.snapshot(KEYWORDS_SNAPSHOT, date).map((i) => i.value as KeywordIdea);
  return {
    date, stale: addDays(date, KEYWORDS_STALE_DAYS) < today,
    groups: groups.map((g) => {
      const mine = ideas.filter((i) => i.group === g.id).sort((a, b) => b.volume - a.volume || a.text.localeCompare(b.text)).map((i): KeywordRow => {
        const months = [...i.months].sort((a, b) => a.month.localeCompare(b.month));
        const mean = months.reduce((s, m) => s + m.searches, 0) / (months.length || 1);
        const last = months.at(-1);
        return { ...i, trend: last && mean > 0 ? last.searches / mean - 1 : null };
      });
      return { ...g, total: mine.reduce((s, i) => s + i.volume, 0), ideas: mine };
    }),
  };
}
