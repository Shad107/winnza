// Plugin « site » : identité du site (adresse, nom, description) et choix éditoriaux des pages, écrits
// en base. Le site web ne lit que la base ; ces réglages y entrent par ici (et demain par le plugin IA).
import { PLUGIN_CATEGORY, type Plugin } from "../../contract.js";

export const SITE_SETTING = { site: "site", fuelPage: "page.fuel" } as const;

export type SiteDecl = {
  url: string; name: string; locale: string; description: string;
  pages: { path: string; changefreq: string; priority: number }[];
  /** éditeur (pseudonyme, lien) et hébergeur : les mentions obligatoires de la LCEN */
  publisher: { name: string; url: string; note: string };
  host: { name: string; address: string; phone: string; url: string };
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
  const pub = (o.publisher ?? {}) as Obj, host = (o.host ?? {}) as Obj;
  return { url: need(o, "url", f).replace(/\/$/, ""), name: need(o, "name", f), locale: need(o, "locale", f),
    description: need(o, "description", f), pages: o.pages as SiteDecl["pages"],
    publisher: { name: need(pub, "name", "site.publisher"), url: need(pub, "url", "site.publisher"), note: need(pub, "note", "site.publisher") },
    host: { name: need(host, "name", "site.host"), address: need(host, "address", "site.host"), phone: need(host, "phone", "site.host"),
      url: need(host, "url", "site.host") } };
}

export function parseFuelPageDecl(json: unknown): FuelPageDecl {
  const f = "page carburants", o = (json ?? {}) as Obj, ref = (o.reference ?? {}) as Obj;
  return { country: need(o, "country", f), products: strings(o, "products", f), historyFrom: need(o, "historyFrom", f),
    neighbours: strings(o, "neighbours", f),
    reference: { label: need(ref, "label", f), from: need(ref, "from", f), to: need(ref, "to", f) } };
}

/** Réglages du plugin site : l'identité du site et les choix de la page carburants. */
export function parseSiteSettings(json: unknown): { site: SiteDecl; fuelPage: FuelPageDecl } {
  const o = (json ?? {}) as Obj;
  return { site: parseSiteDecl(o.site), fuelPage: parseFuelPageDecl(o.fuelPage) };
}

export const sitePlugin: Plugin = {
  id: "site",
  title: { fr: "Site", en: "Site" },
  description: { fr: "Identité du site, mentions légales et choix éditoriaux des pages.", en: "Site identity, legal notice and page choices." },
  category: PLUGIN_CATEGORY.site,
  register(api) {
      const { site, fuelPage } = parseSiteSettings(api.settings());
      api.declareSetting({ key: SITE_SETTING.site, value: site });
      api.declareSetting({ key: SITE_SETTING.fuelPage, value: fuelPage });
  },
};
