// Téléchargements. Un nom de client générique, sans adresse personnelle (certaines sources publiques
// refusent les requêtes sans User-Agent).
import type { CollectContext } from "./contract.js";

const USER_AGENT = "winnza-collector/0.1 (+https://www.winnza.eu)";
const TIMEOUT_MS = 180_000;

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res;
}

export const httpContext: CollectContext = {
  fetchBytes: async (url) => new Uint8Array(await (await get(url)).arrayBuffer()),
  fetchText: async (url) => (await get(url)).text(),
};
