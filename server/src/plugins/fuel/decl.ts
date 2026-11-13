// Lecture et contrôle de declarations/fuel.json. Un champ manquant est une erreur au démarrage,
// pas un « undefined » qui se propage jusqu'à l'écran.
import type { SourceDecl } from "../../contract.js";

export type FuelProduct = { id: string; label: string; bulletinCode: string; vatColumnLabel: string };
export type FuelCountry = { code: string; label: string };
export type FuelDecl = {
  sources: { oilBulletin: SourceDecl; brent: SourceDecl; eurusd: SourceDecl };
  products: FuelProduct[];
  countries: FuelCountry[];
};

type Obj = Record<string, unknown>;
const str = (o: Obj, k: string, where: string): string => {
  if (typeof o[k] !== "string" || !o[k]) throw new Error(`fuel.json, ${where} : « ${k} » manquant`);
  return o[k] as string;
};
const obj = (o: unknown, where: string): Obj => {
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error(`fuel.json, ${where} : objet attendu`);
  return o as Obj;
};
const list = (o: unknown, where: string): Obj[] => {
  if (!Array.isArray(o) || !o.length) throw new Error(`fuel.json, ${where} : liste non vide attendue`);
  return o.map((x, i) => obj(x, `${where}[${i}]`));
};

function source(o: unknown, where: string): SourceDecl {
  const s = obj(o, where);
  return { id: str(s, "id", where), name: str(s, "name", where), publisher: str(s, "publisher", where),
    url: str(s, "url", where), licence: str(s, "licence", where) };
}

export type FuelCatalog = { products: FuelProduct[]; countries: FuelCountry[] };

/** Produits et pays : lu dans le fichier par le plugin, et en base par les pages (même contrôle). */
export function parseFuelCatalog(json: unknown): FuelCatalog {
  const root = obj(json, "racine");
  return {
    products: list(root.products, "products").map((p, i) => ({ id: str(p, "id", `products[${i}]`),
      label: str(p, "label", `products[${i}]`), bulletinCode: str(p, "bulletinCode", `products[${i}]`),
      vatColumnLabel: str(p, "vatColumnLabel", `products[${i}]`) })),
    countries: list(root.countries, "countries").map((c, i) => ({ code: str(c, "code", `countries[${i}]`),
      label: str(c, "label", `countries[${i}]`) })),
  };
}

export function parseFuelDecl(json: unknown): FuelDecl {
  const src = obj(obj(json, "racine").sources, "sources");
  return {
    sources: { oilBulletin: source(src.oilBulletin, "sources.oilBulletin"), brent: source(src.brent, "sources.brent"),
      eurusd: source(src.eurusd, "sources.eurusd") },
    ...parseFuelCatalog(json),
  };
}
