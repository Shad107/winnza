// Fichiers du fond de carte, servis par Winnza : le navigateur ne contacte aucun tiers.
//   france.pmtiles                    fond OpenStreetMap, lu par morceaux (requêtes « Range »)
//   fonts/<police>/<plage>.pbf        polices des noms de lieux
//   sprites/<thème>[@2x].(json|png)   icônes
// Dossier : WINNZA_MAP_DIR (monté en lecture seule), rempli par scripts/fetch-map.sh.
import { error } from '@sveltejs/kit';
import { createReadStream, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const ROOT = resolve(process.env.WINNZA_MAP_DIR ?? join(process.cwd(), '..', 'data', 'map'));
const ALLOWED = [/^france\.pmtiles$/, /^fonts\/Noto Sans (Regular|Medium|Italic)\/\d+-\d+\.pbf$/, /^sprites\/(light|dark)(@2x)?\.(json|png)$/];
const TYPE: Record<string, string> = { pmtiles: 'application/octet-stream', pbf: 'application/x-protobuf', json: 'application/json', png: 'image/png' };

export const GET = ({ params, request }) => {
  const rel = params.path;
  if (!ALLOWED.some((re) => re.test(rel))) error(404, 'Introuvable');
  const file = resolve(ROOT, rel);
  if (!file.startsWith(ROOT + sep)) error(404, 'Introuvable');
  let size: number;
  try { size = statSync(file).size; } catch { error(404, 'Introuvable'); }
  const headers: Record<string, string> = {
    'content-type': TYPE[rel.split('.').pop() ?? ''] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=86400',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (!range) {
    headers['content-length'] = String(size);
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers });
  }
  // « bytes=a-b », « bytes=a- » ou « bytes=-n » (les n derniers octets)
  const [a, b] = [range[1] ?? '', range[2] ?? ''];
  const start = a === '' ? Math.max(0, size - Number(b)) : Number(a);
  const end = a === '' || b === '' ? size - 1 : Math.min(Number(b), size - 1);
  if (!(start <= end && start < size)) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  headers['content-range'] = `bytes ${start}-${end}/${size}`;
  headers['content-length'] = String(end - start + 1);
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers });
};
