import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStatus } from '@winnza/core/pages/status.js';
import { currentPageErrors, withReadStore } from '#lib/server/data.ts';

// L'état de santé du site, pour l'agent de maintenance et pour qui veut savoir : collectes, sources en panne,
// déploiement, fraîcheur des données, pages retirées. Public et sans secret (voir server/src/pages/status.ts).
const STATE_DIR = process.env.WINNZA_STATE_DIR;

export const GET = () => {
  let deploy: string | null = null;
  try { deploy = STATE_DIR ? readFileSync(join(STATE_DIR, 'deploy.state'), 'utf8') : null; } catch { deploy = null; }
  const status = withReadStore((s) => buildStatus(s, deploy, currentPageErrors()));
  return new Response(JSON.stringify(status, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
};
