// Plugin électricité : le kWh découpé comme le litre.
//   - tarifs réglementés (tarif Bleu) de la CRE depuis 2012, options Base, Heures creuses et Tempo, pour
//     les puissances déclarées ; l'accise et la TVA de chaque prix en sont calculées ;
//   - prix moyen payé par les ménages et ses composantes (énergie, réseau, taxes, TVA) dans chaque pays
//     de l'Union, d'après Eurostat ;
//   - couleur de chaque jour Tempo, saison en cours et précédente.
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Plugin } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { addDays, parisDate } from "../../units.js";
import { parseElecDecl } from "./decl.js";
import { deriveEuTaxes, deriveTrvTaxes } from "./derive.js";
import { parseEuComponents, parseEuPrices, parseTempo, parseTrvCsv, parseWholesale, tempoSeason } from "./parse.js";
import { ELEC_CATALOG_SETTING, EU_PART, euSeriesId, SUBSCRIPTION, TEMPO_SERIES, TRV_PART, trvSeriesId, wholesaleSeriesId, type EuPart, type TrvPart } from "./series-ids.js";

const TRV_PART_LABEL = {
  [TRV_PART.ht]: "hors taxes", [TRV_PART.ttc]: "toutes taxes comprises",
  [TRV_PART.excise]: "accise sur l'électricité", [TRV_PART.vat]: "TVA",
} satisfies Record<TrvPart, string>;
const EU_PART_LABEL = {
  [EU_PART.energy]: "énergie et fourniture", [EU_PART.network]: "réseau (transport et distribution)",
  [EU_PART.taxesWithVat]: "taxes et prélèvements, TVA comprise", [EU_PART.vat]: "TVA",
  [EU_PART.taxes]: "taxes et prélèvements hors TVA", [EU_PART.price]: "prix moyen toutes taxes comprises",
} satisfies Record<EuPart, string>;

export const electricityPlugin: Plugin = {
  id: "electricity",
  title: { fr: "Électricité", en: "Electricity" },
  description: { fr: "Tarifs réglementés depuis 2012 (CRE), le kWh découpé en énergie, réseau, taxes et TVA dans chaque pays de l'Union (Eurostat), couleur Tempo du jour.",
    en: "Regulated tariffs since 2012 (CRE), the kWh split into energy, network, taxes and VAT in each EU country (Eurostat), Tempo colour of the day." },
  category: PLUGIN_CATEGORY.data,
  settings: jsonSettings(parseElecDecl, { fr: "Sources (adresses), colonnes des fichiers de la CRE, puissances, pays et règles Tempo. Vérifié avant enregistrement ; pris en compte à la prochaine collecte.",
    en: "Sources (URLs), CRE file columns, powers, countries and Tempo rules. Checked before saving; applied at the next collection." }),
  register(api) {
    const decl = parseElecDecl(api.settings());
    const { sources, trv, eurostat } = decl;
    for (const s of Object.values(sources)) api.declareSource(s);
    const { sources: _s, ...catalog } = decl;
    api.declareSetting({ key: ELEC_CATALOG_SETTING, value: catalog });

    for (const o of trv.options) for (const kva of trv.powers) {
      const sourceId = sources[o.source].id;
      for (const part of [TRV_PART.ht, TRV_PART.ttc]) {
        api.declareSeries({ id: trvSeriesId(o.id, kva, SUBSCRIPTION, part), label: `Tarif Bleu ${o.label}, ${kva} kVA : abonnement annuel, ${TRV_PART_LABEL[part]}`,
          unit: UNIT.eurPerYear, frequency: FREQUENCY.onChange, sourceId });
      }
      for (const p of o.periods) for (const part of Object.values(TRV_PART)) {
        const derived = part === TRV_PART.excise || part === TRV_PART.vat;
        api.declareSeries({ id: trvSeriesId(o.id, kva, p.id, part), label: `Tarif Bleu ${o.label}, ${kva} kVA, ${p.label.toLowerCase()} : kWh, ${TRV_PART_LABEL[part]}`,
          unit: UNIT.eurPerKwh, frequency: FREQUENCY.onChange, sourceId,
          ...(derived ? { derivedFrom: [trvSeriesId(o.id, kva, p.id, TRV_PART.ht), trvSeriesId(o.id, kva, p.id, TRV_PART.ttc)] } : {}) });
      }
    }
    // un fichier par option, toutes les puissances déclarées d'un coup
    for (const o of trv.options) api.registerCollector({ id: `electricity.trv.${o.id}`, run: async (ctx) => parseTrvCsv(await ctx.fetchText(sources[o.source].url), o, decl) });

    for (const c of eurostat.countries) {
      for (const part of Object.values(EU_PART)) {
        const isPrice = part === EU_PART.price;
        api.declareSeries({ id: euSeriesId(c.code, part), label: `Électricité, ${c.label} : ${EU_PART_LABEL[part]}, ${eurostat.bandLabel}`,
          unit: UNIT.eurPerKwh, frequency: isPrice ? FREQUENCY.semiannual : FREQUENCY.annual,
          sourceId: isPrice ? sources.prices.id : sources.components.id,
          ...(part === EU_PART.taxes ? { derivedFrom: [euSeriesId(c.code, EU_PART.taxesWithVat), euSeriesId(c.code, EU_PART.vat)] } : {}) });
      }
    }
    api.registerCollector({ id: "electricity.eu-components", run: async (ctx) => parseEuComponents(await ctx.fetchText(sources.components.url), decl) });
    api.registerCollector({ id: "electricity.eu-prices", run: async (ctx) => parseEuPrices(await ctx.fetchText(sources.prices.url), decl) });

    api.declareSeries({ id: TEMPO_SERIES, label: "Couleur du jour Tempo", unit: UNIT.tempoCode, frequency: FREQUENCY.daily, sourceId: sources.tempo.id });
    api.registerCollector({ id: "electricity.tempo", run: async (ctx) => {
      // saison en cours et précédente : de quoi compter les jours rouges et blancs déjà passés
      const current = tempoSeason(parisDate(), decl.tempo.seasonStartMonth);
      const from = Number(current.slice(0, 4));
      const seasons = [`${from - 1}-${from}`, current];
      const lists = await Promise.all(seasons.map(async (s) => parseTempo(await ctx.fetchText(`${sources.tempo.url}?periode%5B%5D=${s}`), decl)));
      return lists.flat();
    } });

    // prix de gros : UNE requête pour tout l'historique, jusqu'à demain (publié la veille vers 13 h) ; une
    // requête par année déclenchait la limite de débit de la source (HTTP 429, mesuré le 2026-11-14)
    const ws = decl.wholesale;
    api.declareSeries({ id: wholesaleSeriesId(ws.area), label: `Prix de gros de l'électricité (${ws.area}), moyenne du jour`, unit: UNIT.eurPerKwh,
      frequency: FREQUENCY.daily, sourceId: sources.wholesale.id,
      description: "Le prix auquel l'électricité s'échange la veille pour le lendemain sur le marché de gros : l'équivalent du baril pour le kWh." });
    api.registerCollector({ id: "electricity.wholesale", optional: true, produces: [wholesaleSeriesId(ws.area)], run: async (ctx) => {
      const url = sources.wholesale.url.replace("{area}", ws.area).replace("{start}", `${ws.since}-01-01`).replace("{end}", addDays(parisDate(), 1));
      return parseWholesale(await ctx.fetchText(url), decl);
    } });

    api.registerDerivation({ id: "electricity.trv-taxes", run: (read) => deriveTrvTaxes(read, decl) });
    api.registerDerivation({ id: "electricity.eu-taxes", run: (read) => deriveEuTaxes(read, decl) });
  },
};
