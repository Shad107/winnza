// Plugin « site » : identité du site (adresse, nom, description) et choix éditoriaux des pages, écrits
// en base. Le site web ne lit que la base ; ces réglages y entrent par ici (et demain par le plugin IA).
import type { Plugin } from "../../contract.js";

export const SITE_SETTING = { site: "site", fuelPage: "page.fuel" } as const;

export type SiteDecl = {
  url: string; name: string; locale: string; description: string;
  pages: { path: string; changefreq: string; priority: number }[];
};
export type FuelPageDecl = {
  country: string; products: string[]; historyFrom: string; neighbours: string[];
  reference: { label: string; from: string; to: string };
};

type Obj = Record<string, unknown>;
const need = (o: Obj, k: string, f: string): string => {
  if (typeof o[k] !== "string" || !o[k]) throw new Error(`${f} : « ${k} » manquant`);
  return o[k] as string;
};
const strings = (o: Obj, k: string, f: string): string[] => {
  const v = o[k];
  if (!Array.isArray(v) || !v.length || v.some((x) => typeof x !== "string")) throw new Error(`${f} : « ${k} » doit être une liste de textes`);
  return v as string[];
};

export function parseSiteDecl(json: unknown): SiteDecl {
  const f = "site", o = (json ?? {}) as Obj;
  if (!Array.isArray(o.pages) || !o.pages.length) throw new Error(`${f} : « pages » doit être une liste non vide`);
  return { url: need(o, "url", f).replace(/\/$/, ""), name: need(o, "name", f), locale: need(o, "locale", f),
    description: need(o, "description", f), pages: o.pages as SiteDecl["pages"] };
}

export function parseFuelPageDecl(json: unknown): FuelPageDecl {
  const f = "page carburants", o = (json ?? {}) as Obj, ref = (o.reference ?? {}) as Obj;
  return { country: need(o, "country", f), products: strings(o, "products", f), historyFrom: need(o, "historyFrom", f),
    neighbours: strings(o, "neighbours", f),
    reference: { label: need(ref, "label", f), from: need(ref, "from", f), to: need(ref, "to", f) } };
}

export function sitePlugin(site: SiteDecl, fuelPage: FuelPageDecl): Plugin {
  return {
    id: "site",
    title: "Site",
    register(api) {
      api.declareSetting({ key: SITE_SETTING.site, value: site });
      api.declareSetting({ key: SITE_SETTING.fuelPage, value: fuelPage });
    },
  };
}
