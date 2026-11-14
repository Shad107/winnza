// Plugin « carte » : les contours des départements, pour dessiner une carte de France sans bibliothèque
// ni tuile tierce. Les contours sont déclarés (déjà projetés en tracés SVG) et rangés en base ; la page
// les lit comme n'importe quel réglage.
//
// Les tracés viennent du contour officiel (IGN ADMIN EXPRESS, version simplifiée) par la commande
//   node dist/cli.js outlines <departements.geojson> declarations/map.json
// qui projette, simplifie et réécrit `shapes` et `viewBox` en gardant le reste du fichier.
import { PLUGIN_CATEGORY, type Plugin, type SourceDecl } from "../../contract.js";
import { jsonSettings } from "../json-settings.js";

export type MapShape = { code: string; label: string; d: string };
export type MapDecl = { source: SourceDecl; viewBox: [number, number]; shapes: MapShape[] };

/** Réglage en base lu par la page des départements. */
export const MAP_SETTING = "map.departments";

type Obj = Record<string, unknown>;
const PATH_RE = /^[MlZ0-9\- ]+$/;
export function parseMapDecl(json: unknown): MapDecl {
  const o = (json ?? {}) as Obj, s = (o.source ?? {}) as Obj;
  const str = (v: unknown, k: string) => { if (typeof v !== "string" || !v) throw new Error(`carte : « ${k} » manquant`); return v; };
  const vb = o.viewBox;
  if (!Array.isArray(vb) || vb.length !== 2 || !vb.every((n) => typeof n === "number" && n > 0)) throw new Error("carte : « viewBox » doit être [largeur, hauteur]");
  if (!Array.isArray(o.shapes) || !o.shapes.length) throw new Error("carte : « shapes » doit être une liste non vide");
  const shapes = (o.shapes as Obj[]).map((x, i) => {
    const d = str(x.d, `shapes[${i}].d`);
    // le tracé part tel quel dans la page : rien d'autre que des commandes et des nombres
    if (!PATH_RE.test(d)) throw new Error(`carte : tracé invalide pour « ${String(x.code)} »`);
    return { code: str(x.code, `shapes[${i}].code`), label: str(x.label, `shapes[${i}].label`), d };
  });
  return {
    source: { id: str(s.id, "source.id"), name: str(s.name, "source.name"), publisher: str(s.publisher, "source.publisher"), url: str(s.url, "source.url"), licence: str(s.licence, "source.licence") },
    viewBox: [vb[0] as number, vb[1] as number], shapes,
  };
}

type Ring = [number, number][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
type Feature = { properties: { code: string; nom: string }; geometry: Geometry };

/** Douglas-Peucker : retire les points à moins de `tol` du segment qui les entoure. */
function simplify(pts: Ring, tol: number): Ring {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]!, [bx, by] = pts[b]!;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      // anneau fermé : premier et dernier points confondus, on mesure alors la distance au point
      const dist = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (dist > far) { far = dist; best = i; }
    }
    if (best > 0 && far > tol) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Projette (équirectangulaire corrigée à la latitude moyenne, suffisante à l'échelle de la France),
 *  met à l'échelle `width`, simplifie et écrit les tracés SVG. */
export function outlinesFromGeoJson(geo: { features: Feature[] }, width: number, tol = 0.6): Pick<MapDecl, "viewBox" | "shapes"> {
  const rings = (g: Geometry): Ring[] => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, latSum = 0, n = 0;
  for (const f of geo.features) for (const r of rings(f.geometry)) for (const [, lat] of r) { latSum += lat; n++; }
  const k = Math.cos(((latSum / n) * Math.PI) / 180);
  const proj = ([lon, lat]: [number, number]): [number, number] => [lon * k, -lat];
  for (const f of geo.features) for (const r of rings(f.geometry)) for (const p of r) {
    const [x, y] = proj(p); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const scale = width / (maxX - minX);
  const height = Math.ceil((maxY - minY) * scale);
  // entiers : à cette échelle, une demi-unité ne se voit pas, et le tracé fond de moitié
  const round = (v: number) => Math.round(v);
  const shapes = geo.features.map((f) => {
    const parts = rings(f.geometry).flatMap((r) => {
      const pts = simplify(r.map((p) => { const [x, y] = proj(p); return [round((x - minX) * scale), round((y - minY) * scale)] as [number, number]; }), tol);
      if (pts.length < 4) return [];
      // premier point absolu, les suivants en écart au précédent (commande « l » relative)
      const rel = pts.slice(1).map(([x, y], i) => [x - pts[i]![0], y - pts[i]![1]]).filter(([dx, dy]) => dx || dy);
      return [`M${pts[0]![0]} ${pts[0]![1]}l${rel.map(([dx, dy]) => `${dx} ${dy}`).join(" ")}Z`];
    });
    return { code: f.properties.code, label: f.properties.nom, d: parts.join("") };
  }).sort((a, b) => a.code.localeCompare(b.code));
  return { viewBox: [width, height], shapes };
}

export const mapPlugin: Plugin = {
  id: "map",
  title: { fr: "Carte", en: "Map" },
  description: { fr: "Les contours des départements, pour la carte des prix.", en: "Department outlines, for the price map." },
  category: PLUGIN_CATEGORY.site,
  settings: jsonSettings(parseMapDecl, { fr: "Source et tracés des départements (régénérés par la commande outlines).", en: "Source and department outlines (regenerated by the outlines command)." }),
  register(api) {
    const decl = parseMapDecl(api.settings());
    api.declareSource(decl.source);
    api.declareSetting({ key: MAP_SETTING, value: decl });
  },
};
