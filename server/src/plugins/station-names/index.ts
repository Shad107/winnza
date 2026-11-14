// Plugin « noms des stations » : le flux officiel ne donne que l'adresse ; OpenStreetMap donne le nom et
// l'enseigne, et beaucoup de stations y portent l'identifiant du flux officiel (ref:FR:prix-carburants).
// Mesuré le 2026-11-14 : 9 454 stations du flux sur 9 486 retrouvées, 9 338 avec un nom ou une enseigne.
//
// Source d'appoint : le serveur public de requêtes OpenStreetMap (Overpass) est souvent saturé ; s'il ne
// répond pas, la collecte garde les derniers noms et continue (instantané `optional`).
import { PLUGIN_CATEGORY, type Plugin, type SnapshotItem, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";
import { parisDate } from "../stations/index.js";

export type StationNamesDecl = { source: SourceDecl; overpassUrl: string; bbox: [number, number, number, number]; keepDays: number };
export type StationName = { name: string };

export const STATION_NAMES_SNAPSHOT = "stations.names";

type Obj = Record<string, unknown>;
export function parseStationNamesDecl(json: unknown): StationNamesDecl {
  const o = (json ?? {}) as Obj, s = (o.source ?? {}) as Obj;
  const str = (v: unknown, k: string) => { if (typeof v !== "string" || !v) throw new Error(`noms des stations : « ${k} » manquant`); return v; };
  const b = o.bbox;
  if (!Array.isArray(b) || b.length !== 4 || !b.every((x) => typeof x === "number")) throw new Error("noms des stations : « bbox » doit être [sud, ouest, nord, est]");
  if (typeof o.keepDays !== "number" || !(o.keepDays > 0)) throw new Error("noms des stations : « keepDays » doit être un nombre positif");
  return {
    source: { id: str(s.id, "source.id"), name: str(s.name, "source.name"), publisher: str(s.publisher, "source.publisher"), url: str(s.url, "source.url"), licence: str(s.licence, "source.licence") },
    overpassUrl: str(o.overpassUrl, "overpassUrl"), bbox: [b[0] as number, b[1] as number, b[2] as number, b[3] as number], keepDays: o.keepDays,
  };
}

export function overpassQuery(decl: StationNamesDecl): string {
  const q = `[out:json][timeout:240];nwr["amenity"="fuel"]["ref:FR:prix-carburants"](${decl.bbox.join(",")});out tags;`;
  return `${decl.overpassUrl}?${new URLSearchParams({ data: q }).toString()}`;
}

/** Un élément par identifiant du flux officiel. Le nom d'usage d'abord, l'enseigne à défaut. Une station
 *  OpenStreetMap peut porter plusieurs identifiants (séparés par « ; »). */
export function parseOverpass(text: string): SnapshotItem[] {
  if (!text.trimStart().startsWith("{")) throw new Error("Overpass : réponse qui n'est pas du JSON (serveur saturé ?)");
  const elements = (JSON.parse(text) as { elements?: { tags?: Record<string, string> }[] }).elements;
  if (!Array.isArray(elements)) throw new Error("Overpass : réponse sans « elements »");
  const out = new Map<string, StationName>();
  for (const e of elements) {
    const t = e.tags ?? {};
    const name = (t.name || t.brand || "").trim();
    if (!name) continue;
    for (const ref of (t["ref:FR:prix-carburants"] ?? "").split(";").map((x) => x.trim())) if (/^\d+$/.test(ref) && !out.has(ref)) out.set(ref, { name });
  }
  return [...out].map(([key, value]) => ({ key, value }));
}

export const stationNamesPlugin: Plugin = {
  id: "station-names",
  title: { fr: "Noms des stations", en: "Station names" },
  description: { fr: "Le nom et l'enseigne de chaque station, depuis OpenStreetMap (le flux officiel n'a que l'adresse).", en: "Each station's name and brand, from OpenStreetMap." },
  category: PLUGIN_CATEGORY.data,
  settings: jsonSettings(parseStationNamesDecl, { fr: "Serveur Overpass, zone, jours gardés.", en: "Overpass server, area, days kept." }),
  register(api) {
    const decl = parseStationNamesDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSnapshot({ id: STATION_NAMES_SNAPSHOT, label: "Nom de chaque station (OpenStreetMap)", sourceId: decl.source.id, keepDays: decl.keepDays, optional: true });
    api.registerSnapshotCollector({ id: "station-names", snapshot: STATION_NAMES_SNAPSHOT,
      run: async (ctx) => ({ date: parisDate(), items: parseOverpass(await ctx.fetchText(overpassQuery(decl))) }) });
  },
};
