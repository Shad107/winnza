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

/** nom d'une variable de secret : majuscules, chiffres, soulignés (jamais une valeur prise pour un nom) */
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/;

export const httpContext: CollectContext = {
  fetchBytes: async (url) => new Uint8Array(await (await get(url)).arrayBuffer()),
  fetchText: async (url) => (await get(url)).text(),
  postText: async (url, body, headers) => {
    const res = await fetch(url, { method: "POST", body, headers: { "user-agent": USER_AGENT, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    // le corps d'erreur de l'API aide au diagnostic ; l'adresse peut porter un identifiant, pas un secret
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url} : ${(await res.text()).slice(0, 300)}`);
    return res.text();
  },
  secret: (name) => {
    if (!SECRET_NAME.test(name)) throw new Error(`nom de secret invalide « ${name} »`);
    const v = process.env[name];
    return v ? v : null;
  },
};
