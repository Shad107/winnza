// Greffon carburants : prix TTC/HT et TVA de chaque pays de l'UE depuis 2005 (bulletin pétrolier
// européen), Brent et euro/dollar, puis la décomposition de chaque litre (voir derive.ts).
import { FREQUENCY, UNIT, type Plugin } from "../../contract.js";
import { readXlsx } from "../../xlsx.js";
import type { FuelDecl } from "./decl.js";
import { deriveBrentEurPerLitre, deriveDecomposition, deriveWeeklyCrude } from "./derive.js";
import { parseBulletinPrices, parseBulletinVat, parseEcbCsv, parseFredCsv } from "./parse.js";
import { FUEL_PART, fuelSeriesId, OIL_SERIES } from "./series-ids.js";

export function fuelPlugin(decl: FuelDecl): Plugin {
  const { sources, countries, products } = decl;
  const reference = countries[0];
  const refProduct = products[0];
  if (!reference || !refProduct) throw new Error("fuel.json : au moins un pays et un produit");

  return {
    id: "fuel",
    title: "Carburants",
    register(api) {
      for (const s of Object.values(sources)) api.declareSource(s);

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
}
