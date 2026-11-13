import { fuelPage, siteDecl } from '#lib/server/data.ts';

export const load = () => ({ asOf: fuelPage().asOf, site: siteDecl() });
