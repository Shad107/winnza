import { buildKeywordsPage } from '@winnza/core/pages/keywords-page.js';
import { parisDate } from '@winnza/core/units.js';
import { withReadStore } from '#lib/server/data.ts';

// Page d'administration (protégée par le garde de /admin) : le dernier relevé Keyword Planner.
export const load = () => ({ keywords: withReadStore((s) => buildKeywordsPage(s, parisDate())) });
