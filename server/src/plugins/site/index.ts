// Plugin « site » : identité du site (adresse, nom, description, pages déclarées, mentions légales), écrite
// en base. Le site web la lit là ; elle y entre par ici, depuis declarations/site.json.
import { PLUGIN_CATEGORY, type Plugin } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";

export const SITE_SETTING = { site: "site" } as const;

export type SiteDecl = {
  url: string; name: string; locale: string; description: string;
  pages: { path: string; changefreq: string; priority: number }[];
  /** éditeur (pseudonyme, lien) et hébergeur : les mentions obligatoires de la LCEN */
  publisher: { name: string; url: string; note: string };
  host: { name: string; address: string; phone: string; url: string };
};
type Obj = Record<string, unknown>;
const need = (o: Obj, k: string, f: string): string => {
  if (typeof o[k] !== "string" || !o[k]) throw new Error(`${f} : « ${k} » manquant`);
  return o[k] as string;
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

/** Réglages du plugin site : l'identité du site. */
export function parseSiteSettings(json: unknown): { site: SiteDecl } {
  return { site: parseSiteDecl(((json ?? {}) as Obj).site) };
}

export const sitePlugin: Plugin = {
  id: "site",
  title: { fr: "Site", en: "Site" },
  description: { fr: "Identité du site et mentions légales.", en: "Site identity and legal notice." },
  category: PLUGIN_CATEGORY.site,
  settings: jsonSettings(parseSiteSettings, { fr: "Identité du site (adresse, éditeur, hébergeur). Pris en compte à la prochaine collecte.",
    en: "Site identity (URL, publisher, host). Applied at the next collection." }),
  register(api) {
      const { site } = parseSiteSettings(api.settings());
      api.declareSetting({ key: SITE_SETTING.site, value: site });
  },
};
