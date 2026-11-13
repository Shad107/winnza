// Plugin « Matomo » : mesure d'audience CÔTÉ SERVEUR, sans cookie, vers le Matomo de Winnza
// (matomo.winnza.eu, hébergé par nous : pas un tiers). Comme sur isno.fr, la page vue part du serveur,
// donc aucun bloqueur ne la coupe ; mais ici sans aucun cookie de visiteur, pour rester dans le cas
// « mesure d'audience exemptée de consentement » sans discussion possible.
//
// Le plugin porte les RÉGLAGES (actif, adresse, site, mode) ; le jeton d'accès reste un secret du
// serveur (variable MATOMO_TOKEN), jamais en base. L'envoi lui-même est fait par le site (web/).
import { SETTING_KIND, TEXT_FORMAT, type PluginSettings } from "@isno-open/plugin-host";
import { PLUGIN_CATEGORY, type Plugin } from "../../contract.js";

export const MATOMO_MODE = {
  /** envoie réellement les pages vues */
  live: "live",
  /** journalise ce qui serait envoyé, sans rien envoyer (essais) */
  dry: "dry",
} as const;
export type MatomoMode = (typeof MATOMO_MODE)[keyof typeof MATOMO_MODE];

export type MatomoSettings = { enabled: boolean; url: string; siteId: number; mode: MatomoMode };

/** Réglage en base lu par le site. */
export const ANALYTICS_SETTING = "analytics.matomo";

type Obj = Record<string, unknown>;
export function parseMatomoSettings(json: unknown): MatomoSettings {
  const o = (json ?? {}) as Obj;
  if (typeof o.enabled !== "boolean") throw new Error("Matomo : « enabled » doit être vrai ou faux");
  if (typeof o.url !== "string" || !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o.url)) throw new Error("Matomo : adresse https attendue, sans chemin (ex. https://matomo.exemple.fr)");
  if (typeof o.siteId !== "number" || !Number.isInteger(o.siteId) || o.siteId < 1) throw new Error("Matomo : numéro de site entier positif attendu");
  if (o.mode !== MATOMO_MODE.live && o.mode !== MATOMO_MODE.dry) throw new Error("Matomo : mode « live » ou « dry »");
  return { enabled: o.enabled, url: o.url, siteId: o.siteId, mode: o.mode };
}

const settings: PluginSettings = {
  fields: [
    { key: "enabled", kind: SETTING_KIND.toggle, label: { fr: "Mesurer l'audience", en: "Measure audience" },
      hint: { fr: "Pages vues envoyées par le serveur, sans cookie. Le jeton reste une variable du serveur (MATOMO_TOKEN).", en: "Server-side page views, no cookie. The token stays a server variable (MATOMO_TOKEN)." } },
    { key: "url", kind: SETTING_KIND.text, format: TEXT_FORMAT.url, maxLength: 200, under: "enabled", label: { fr: "Adresse du Matomo", en: "Matomo address" }, placeholder: "https://matomo.winnza.eu" },
    { key: "siteId", kind: SETTING_KIND.number, min: 1, max: 100000, under: "enabled", label: { fr: "Numéro du site dans Matomo", en: "Matomo site id" } },
    { key: "mode", kind: SETTING_KIND.choice, under: "enabled", label: { fr: "Mode", en: "Mode" },
      options: [{ value: MATOMO_MODE.live, label: { fr: "Envoi réel", en: "Live" } }, { value: MATOMO_MODE.dry, label: { fr: "Essai : journaliser sans envoyer", en: "Dry run: log only" } }] },
  ],
  toForm: (stored) => {
    const s = (stored ?? {}) as Partial<MatomoSettings>;
    return { enabled: s.enabled === true, url: s.url ?? "", siteId: s.siteId ?? 1, mode: s.mode ?? MATOMO_MODE.dry };
  },
  fromForm: (input) => parseMatomoSettings({ enabled: input.enabled === true, url: String(input.url ?? "").replace(/\/+$/, ""),
    siteId: Number(input.siteId), mode: input.mode }),
};

export const matomoPlugin: Plugin = {
  id: "matomo",
  title: { fr: "Mesure d'audience (Matomo)", en: "Audience (Matomo)" },
  description: { fr: "Pages vues envoyées par le serveur vers le Matomo de Winnza, sans cookie et sans tiers.",
    en: "Server-side page views to Winnza's own Matomo, without cookies or third parties." },
  category: PLUGIN_CATEGORY.site,
  settings,
  register(api) {
    api.declareSetting({ key: ANALYTICS_SETTING, value: parseMatomoSettings(api.settings()) });
  },
};
