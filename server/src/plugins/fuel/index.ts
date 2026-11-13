// Greffon carburants : prix TTC/HT et TVA de chaque pays de l'UE depuis 2005 (bulletin pétrolier
// européen), Brent et euro/dollar, puis la décomposition de chaque litre (voir derive.ts).
import { FREQUENCY, PLUGIN_CATEGORY, UNIT, type Plugin } from "../../contract.js";
import { readXlsx } from "../../xlsx.js";
import { parseFuelDecl } from "./decl.js";
import { jsonSettings } from "../json-settings.js";
import { deriveBrentEurPerLitre, deriveDecomposition, deriveWeeklyCrude } from "./derive.js";
import { parseBulletinPrices, parseBulletinVat, parseEcbCsv, parseFredCsv } from "./parse.js";
import { FUEL_CATALOG_SETTING, FUEL_PART, fuelSeriesId, OIL_SERIES } from "./series-ids.js";

export const fuelPlugin: Plugin = {
  id: "fuel",
  title: { fr: "Carburants", en: "Fuels" },
  description: { fr: "Prix, taxes et décomposition du litre dans 27 pays depuis 2005 (bulletin pétrolier européen, Brent, BCE).",
    en: "Prices, taxes and breakdown of a litre in 27 countries since 2005 (EU oil bulletin, Brent, ECB)." },
  category: PLUGIN_CATEGORY.data,
  settings: jsonSettings(parseFuelDecl, { fr: "Sources (adresses), produits et pays suivis. Vérifié avant enregistrement ; pris en compte à la prochaine collecte.",
    en: "Sources (URLs), products and countries. Checked before saving; applied at the next collection." }),
  register(api) {
      // ses réglages (sources, produits, pays) sont en base ; un réglage invalide fait échouer CE plugin seul
      const { sources, countries, products } = parseFuelDecl(api.settings());
      const reference = countries[0];
      const refProduct = products[0];
      if (!reference || !refProduct) throw new Error("réglages carburants : au moins un pays et un produit");

      for (const s of Object.values(sources)) api.declareSource(s);
      // le catalogue (noms des produits et des pays) est lu par les pages : il passe par la base aussi
      api.declareSetting({ key: FUEL_CATALOG_SETTING, value: { products, countries } });

      api.declareSeries({ id: OIL_SERIES.brentUsd, label: "Baril de Brent", unit: UNIT.usdPerBarrel, frequency: FREQUENCY.daily, sourceId: sources.brent.id });
      api.declareSeries({ id: OIL_SERIES.eurusd, label: "Dollars pour un euro", unit: UNIT.usdPerEur, frequency: FREQUENCY.daily, sourceId: sources.eurusd.id });
      api.declareSeries({ id: OIL_SERIES.brentEurPerLitre, label: "Pétrole brut, ramené au litre", unit: UNIT.eurPerLitre, frequency: FREQUENCY.daily,
        sourceId: sources.brent.id, derivedFrom: [OIL_SERIES.brentUsd, OIL_SERIES.eurusd] });
      api.declareSeries({ id: OIL_SERIES.brentEurPerLitreWeekly, label: "Pétrole brut, ramené au litre (moyenne de la semaine)", unit: UNIT.eurPerLitre,
        frequency: FREQUENCY.weekly, sourceId: sources.brent.id, derivedFrom: [OIL_SERIES.brentEurPerLitre] });

      for (const c of countries) for (const p of products) {
        const id = (part: Parameters<typeof fuelSeriesId>[2]) => fuelSeriesId(c.code, p.id, part);
        const name = `${p.label}, ${c.label}`;
        const src = sources.oilBulletin.id;
        api.declareSeries({ id: id(FUEL_PART.ttc), label: `${name} : prix à la pompe`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.weekly, sourceId: src });
        api.declareSeries({ id: id(FUEL_PART.ht), label: `${name} : prix hors taxes`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.weekly, sourceId: src });
        api.declareSeries({ id: id(FUEL_PART.vatRate), label: `${name} : taux de TVA`, unit: UNIT.percent, frequency: FREQUENCY.onChange, sourceId: src });
        api.declareSeries({ id: id(FUEL_PART.vat), label: `${name} : TVA`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.weekly, sourceId: src,
          derivedFrom: [id(FUEL_PART.ttc), id(FUEL_PART.vatRate)] });
        api.declareSeries({ id: id(FUEL_PART.excise), label: `${name} : accise et autres taxes`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.weekly, sourceId: src,
          derivedFrom: [id(FUEL_PART.ttc), id(FUEL_PART.ht), id(FUEL_PART.vatRate)] });
        api.declareSeries({ id: id(FUEL_PART.margin), label: `${name} : raffinage, transport et distribution`, unit: UNIT.eurPerLitre, frequency: FREQUENCY.weekly,
          sourceId: src, derivedFrom: [id(FUEL_PART.ht), OIL_SERIES.brentEurPerLitreWeekly] });
      }

      api.registerCollector({
        id: "fuel.oil-bulletin",
        run: async (ctx) => {
          const book = readXlsx(await ctx.fetchBytes(sources.oilBulletin.url));
          return [...parseBulletinPrices(book, true, countries, products), ...parseBulletinPrices(book, false, countries, products),
            ...parseBulletinVat(book, countries, products)];
        },
      });
      api.registerCollector({ id: "fuel.brent", run: async (ctx) => parseFredCsv(await ctx.fetchText(sources.brent.url)) });
      api.registerCollector({ id: "fuel.eurusd", run: async (ctx) => parseEcbCsv(await ctx.fetchText(sources.eurusd.url)) });

      api.registerDerivation({ id: "fuel.brent-eur-per-litre", run: deriveBrentEurPerLitre });
      api.registerDerivation({ id: "fuel.weekly-crude", run: (read) => deriveWeeklyCrude(read, fuelSeriesId(reference.code, refProduct.id, FUEL_PART.ttc)) });
      api.registerDerivation({ id: "fuel.decomposition", run: (read) => deriveDecomposition(read, countries, products) });
  },
};
