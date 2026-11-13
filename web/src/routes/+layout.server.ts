import { analytics, fuelPage, siteDecl } from '#lib/server/data.ts';

// Toutes les pages lisent les mêmes données (calculées une fois par mise à jour de la base).
export const load = () => ({ asOf: fuelPage().asOf, site: siteDecl(), page: fuelPage(), audience: analytics()?.enabled === true });
