// Plugin « charges cachées » : ce que l'État impose aux vendeurs de carburant et qui finit dans le prix
// sans figurer sur le ticket (CEE, stocks stratégiques, biocarburants). Aucune source ne les publie en
// continu : chaque montant est un relevé daté, avec sa source, écrit en base comme une série. Une
// charge dont le coût n'est pas publié a sa série mais aucune valeur : le site affiche « non publié ».
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Plugin } from "../../contract.js";

export type HiddenChargeDecl = {
  id: string; label: string; description: string;
  eurPerLitre: number | null;
  asOf: string;
  source: { name: string; url: string };
};

/** Clé du réglage qui donne l'ordre d'affichage des charges. */
export const HIDDEN_CHARGES_SETTING = "charges.order";
export const chargeSeriesId = (id: string) => `charge.${id}.eur_per_litre`;
export const chargeSourceId = (id: string) => `charge-${id}`;

type Obj = Record<string, unknown>;
const need = (o: Obj, k: string): string => {
  if (typeof o[k] !== "string" || !o[k]) throw new Error(`hidden-charges.json : « ${k} » manquant`);
  return o[k] as string;
};

export function parseHiddenCharges(json: unknown): HiddenChargeDecl[] {
  const list = ((json ?? {}) as Obj).charges;
  if (!Array.isArray(list) || !list.length) throw new Error("hidden-charges.json : « charges » doit être une liste non vide");
  return list.map((c: Obj, i) => {
    const src = (c.source ?? {}) as Obj;
    const v = c.eurPerLitre;
    if (v !== null && (typeof v !== "number" || v < 0)) throw new Error(`hidden-charges.json, charge ${i} : eurPerLitre doit être un nombre positif ou null`);
    return { id: need(c, "id"), label: need(c, "label"), description: need(c, "description"), eurPerLitre: v as number | null,
      asOf: need(c, "asOf"), source: { name: need(src, "name"), url: need(src, "url") } };
  });
}

export const hiddenChargesPlugin: Plugin = {
  id: "hidden-charges",
  title: { fr: "Charges cachées", en: "Hidden charges" },
  description: { fr: "Ce que l'État impose aux vendeurs de carburant et qui finit dans le prix sans figurer sur le ticket.",
    en: "State obligations on fuel sellers that end up in the price without appearing on the receipt." },
  category: PLUGIN_CATEGORY.data,
  register(api) {
      const charges = parseHiddenCharges(api.settings());
      for (const c of charges) {
        api.declareSource({ id: chargeSourceId(c.id), name: c.source.name, publisher: c.source.name, url: c.source.url,
          licence: "Citation avec mention de la source" });
        api.declareSeries({ id: chargeSeriesId(c.id), label: c.label, description: c.description, unit: UNIT.eurPerLitre,
          frequency: FREQUENCY.onChange, sourceId: chargeSourceId(c.id) });
      }
      api.declareSetting({ key: HIDDEN_CHARGES_SETTING, value: charges.map((c) => c.id) });
      api.registerCollector({
        id: "hidden-charges.readings",
        run: async () => charges.flatMap((c) => (c.eurPerLitre === null ? [] : [{ seriesId: chargeSeriesId(c.id), date: c.asOf, value: c.eurPerLitre }])),
      });
  },
};
