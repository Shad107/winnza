// Réglage déclaré commun aux plugins de Winnza dont la configuration est structurée (listes de pays,
// de produits, de charges) : un seul champ JSON, validé ENTIÈREMENT par le contrôle du plugin avant
// d'être enregistré. Un réglage invalide est refusé à la saisie, il n'atteint jamais la base.
import { SETTING_KIND, type PluginSettings } from "@isno-open/plugin-host";

export const JSON_SETTING_KEY = "config";

export function jsonSettings(parse: (json: unknown) => unknown, hint: { fr: string; en: string }): PluginSettings {
  return {
    fields: [{ key: JSON_SETTING_KEY, kind: SETTING_KIND.json, rows: 28, label: { fr: "Configuration", en: "Configuration" }, hint }],
    toForm: (stored) => ({ [JSON_SETTING_KEY]: JSON.stringify(stored ?? {}, null, 2) }),
    fromForm: (input) => {
      const text = input[JSON_SETTING_KEY];
      if (typeof text !== "string") throw new Error("configuration absente");
      let json: unknown;
      try { json = JSON.parse(text); } catch { throw new Error("ce n'est pas du JSON valide"); }
      parse(json);          // lève une erreur explicite si la configuration ne convient pas
      return json;          // on enregistre ce qui a été saisi, une fois prouvé valide
    },
  };
}
