import { analytics, siteDecl } from '#lib/server/data.ts';

// Ce que toutes les pages lisent : l'identité du site et la mesure d'audience.
export const load = () => ({ site: siteDecl(), audience: analytics()?.enabled === true });
