import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CollectContext } from "../../contract.js";
import { buildRegistry, runCollect } from "../../runner.js";
import { Store } from "../../store.js";
import { parseRows, parseSearchConsoleDecl, PERIOD_KEY, SEARCH_CONSOLE_SNAPSHOT, searchConsolePlugin, serviceAccountAssertion, type SearchPeriod } from "./index.js";

const DECL = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../declarations/search-console.json"), "utf8")) as Record<string, unknown>;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const KEY = { client_email: "lecture@projet.iam.gserviceaccount.com", private_key: privateKey };

test("assertion du compte de service : signée RS256, vérifiable, portée en lecture seule", () => {
  const jwt = serviceAccountAssertion(KEY, "https://www.googleapis.com/auth/webmasters.readonly", "https://oauth2.googleapis.com/token", 1_800_000_000);
  const [h, c, s] = jwt.split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s!, "base64url")));
  const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
  assert.equal(claims.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.equal(claims.exp - claims.iat, 3600);
});

// Témoin : demander plus que la lecture est refusé dans la déclaration, avant tout appel à Google.
test("déclaration : une portée autre que la lecture seule est refusée", () => {
  assert.throws(() => parseSearchConsoleDecl({ ...DECL, api: { ...(DECL.api as object), scope: "https://www.googleapis.com/auth/webmasters" } }), /seule la lecture/);
});

test("lignes : page et recherche, mesures ; une ligne incomplète est écartée", () => {
  assert.deepEqual(parseRows('{"rows":[{"keys":["https://www.winnza.eu/","prix essence"],"clicks":2,"impressions":40,"ctr":0.05,"position":8.2},{"keys":["x"]}]}'),
    [{ page: "https://www.winnza.eu/", query: "prix essence", clicks: 2, impressions: 40, ctr: 0.05, position: 8.2 }]);
  assert.deepEqual(parseRows("{}"), [], "site neuf : aucune ligne, pas une erreur");
});

function fake(secret: string | null, rows = '{"rows":[]}') {
  const urls: string[] = [];
  const ctx: CollectContext = {
    fetchBytes: async () => new Uint8Array(), fetchText: async (u) => { throw new Error(`GET inattendu ${u}`); },
    secret: () => secret,
    postText: async (url) => { urls.push(url); return url.includes("oauth2") ? '{"access_token":"at"}' : rows; },
  };
  return { ctx, urls };
}
const collect = async (store: Store, ctx: CollectContext) => runCollect(store, await buildRegistry({ "search-console": searchConsolePlugin }, ["search-console"], () => DECL), ctx, []);

test("collecte : site neuf sans impressions, la période est quand même relevée", async () => {
  const store = new Store(":memory:");
  const f = fake(Buffer.from(JSON.stringify(KEY)).toString("base64"));
  const r = await collect(store, f.ctx);
  assert.deepEqual(r.warnings, []);
  assert.ok(f.urls[1]!.includes(encodeURIComponent("https://www.winnza.eu/")));
  const items = store.snapshot(SEARCH_CONSOLE_SNAPSHOT, store.snapshotDates(SEARCH_CONSOLE_SNAPSHOT).at(-1)!);
  assert.equal((items.find((i) => i.key === PERIOD_KEY)!.value as SearchPeriod).rows, 0);
});

test("clé absente : avertissement, la collecte continue", async () => {
  const r = await collect(new Store(":memory:"), fake(null).ctx);
  assert.match(r.warnings.join(), /GSC_SERVICE_ACCOUNT_B64 absente/);
});
