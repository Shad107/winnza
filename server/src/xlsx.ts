// Lecteur xlsx minimal : un classeur est un zip de XML. On n'a besoin que des valeurs des cellules
// (pas des styles ni des formules), d'où ce lecteur plutôt qu'une grosse bibliothèque.
import { unzipSync, strFromU8 } from "fflate";

/** Une ligne : lettre de colonne -> valeur (nombre si la cellule est numérique, texte sinon). */
export type Row = Map<string, string | number>;
export type Workbook = Map<string, Row[]>;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e.startsWith("#x") ? String.fromCodePoint(parseInt(e.slice(2), 16))
      : e.startsWith("#") ? String.fromCodePoint(parseInt(e.slice(1), 10))
        : ENTITIES[e] ?? "");
}

/** Texte d'un élément <si> ou <is> : concatène tous les <t> (le texte enrichi est découpé en runs). */
function textOf(xml: string): string {
  return decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1] ?? "").join(""));
}

function read(files: Record<string, Uint8Array>, path: string): string {
  const f = files[path];
  if (!f) throw new Error(`xlsx : fichier interne absent : ${path}`);
  return strFromU8(f);
}

export function readXlsx(bytes: Uint8Array): Workbook {
  const files = unzipSync(bytes);
  const shared = files["xl/sharedStrings.xml"]
    ? [...read(files, "xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1] ?? ""))
    : [];
  const rels = read(files, "xl/_rels/workbook.xml.rels");
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\s([^>]*)\/?>/g)) {
    const attrs = m[1] ?? "";
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) targets.set(id, target);
  }
  const book: Workbook = new Map();
  for (const m of read(files, "xl/workbook.xml").matchAll(/<sheet\s([^>]*)\/?>/g)) {
    const attrs = m[1] ?? "";
    const name = decodeXml(/\bname="([^"]+)"/.exec(attrs)?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    const target = rid ? targets.get(rid) : undefined;
    if (!name || !target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^xl\//, "")}`;
    book.set(name, parseSheet(read(files, path), shared));
  }
  return book;
}

function parseSheet(xml: string, shared: string[]): Row[] {
  const rows: Row[] = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Row = new Map();
    // une cellule : <c r="B4" t="s"><v>12</v></c>, ou auto-fermante <c r="B4" s="3"/>
    for (const cm of (rm[1] ?? "").matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] ?? "";
      const body = cm[2] ?? "";
      const col = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!col) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      if (type === "inlineStr") { row.set(col, textOf(body)); continue; }
      const v = /<v>([^<]*)<\/v>/.exec(body)?.[1];
      if (v === undefined) continue;
      if (type === "s") row.set(col, shared[Number(v)] ?? "");
      else if (type === "str" || type === "e") row.set(col, decodeXml(v));
      else {
        const n = Number(v);
        row.set(col, Number.isFinite(n) ? n : decodeXml(v));
      }
    }
    rows.push(row);
  }
  return rows;
}
