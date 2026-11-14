import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CollectContext } from "../../contract.js";
import { buildRegistry, runCollect } from "../../runner.js";
import { Store } from "../../store.js";
import { KEYWORDS_SNAPSHOT, keywordsPlugin, parseIdeas, parseKeywordsDecl, type KeywordIdea } from "./index.js";

const DECL = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../declarations/keywords.json"), "utf8")) as Record<string, unknown>;
const decl = parseKeywordsDecl(DECL);
const group = decl.groups[0]!;

const IDEAS = JSON.stringify({ results: [
  { text: "prix essence", keywordIdeaMetrics: { avgMonthlySearches: "90500", competition: "LOW", monthlySearchVolumes: [{ month: "OCTOBER", year: "2026", monthlySearches: "110000" }] } },
  { text: "Prix Essence", keywordIdeaMetrics: { avgMonthlySearches: "10" } },
  { text: "prix essence leclerc", keywordIdeaMetrics: { avgMonthlySearches: "12100", competition: "MEDIUM" } },
  { text: "", keywordIdeaMetrics: { avgMonthlySearches: "5" } },
] });

test("idées : triées par volume, doublons de casse retirés, mois lus, graines repérées", () => {
  const ideas = parseIdeas(IDEAS, group, 10);
  assert.deepEqual(ideas.map((i) => [i.text, i.volume, i.seed]), [["prix essence", 90500, true], ["prix essence leclerc", 12100, false]]);
  assert.deepEqual(ideas[0]!.months, [{ month: "2026-10", searches: 110000 }]);
  assert.equal(parseIdeas(IDEAS, group, 1).length, 1);
  assert.throws(() => parseIdeas('{"error":"x"}', group, 10), /sans « results »/);
});

test("déclaration : une VALEUR de secret à la place d'un nom de variable est refusée", () => {
  const api = { ...(DECL.api as object), secrets: { ...((DECL.api as Record<string, unknown>).secrets as object), refreshToken: "1//0gAbCdEf-ghij" } };
  assert.throws(() => parseKeywordsDecl({ ...DECL, api }), /NOM de variable/);
});

function fakeGoogle(secrets: Record<string, string>, tokenReply: () => string) {
  const posts: { url: string; headers: Record<string, string> }[] = [];
  const ctx: CollectContext = {
    fetchBytes: async () => new Uint8Array(), fetchText: async (u) => { throw new Error(`GET inattendu ${u}`); },
    secret: (n) => secrets[n] ?? null,
    postText: async (url, _body, headers) => {
      posts.push({ url, headers });
      if (url === decl.api.tokenUrl) return tokenReply();
      return IDEAS;
    },
  };
  return { ctx, posts };
}
const SECRETS = { GOOGLE_ADS_CUSTOMER_ID: "561-400-9089", GOOGLE_ADS_CLIENT_ID: "SECRET-VALEUR-ID", GOOGLE_ADS_CLIENT_SECRET: "SECRET-VALEUR-CS", GOOGLE_ADS_REFRESH_TOKEN: "SECRET-VALEUR-RT" };
const collect = async (store: Store, ctx: CollectContext) => runCollect(store, await buildRegistry({ keywords: keywordsPlugin }, ["keywords"], () => DECL), ctx, []);

test("collecte : un jeton, une requête par groupe, client sans tirets, instantané par groupe", async () => {
  const store = new Store(":memory:");
  const g = fakeGoogle(SECRETS, () => '{"access_token":"at"}');
  const r = await collect(store, g.ctx);
  assert.deepEqual(r.warnings, []);
  assert.equal(g.posts.length, 1 + decl.groups.length);
  assert.ok(g.posts[1]!.url.includes("/customers/5614009089:generateKeywordIdeas"));
  assert.equal(g.posts[1]!.headers.authorization, "Bearer at");
  const date = store.snapshotDates(KEYWORDS_SNAPSHOT).at(-1)!;
  const items = store.snapshot(KEYWORDS_SNAPSHOT, date);
  assert.equal(items.length, 2 * decl.groups.length);
  assert.equal((items.find((i) => i.key === `${group.id}|prix essence`)!.value as KeywordIdea).volume, 90500);
});

// Témoins : jeton expiré ou secret absent ne cassent pas la collecte (source d'appoint), et le message le dit
// sans jamais contenir de valeur secrète.
test("jeton Google expiré : avertissement clair, collecte non bloquée", async () => {
  const g = fakeGoogle(SECRETS, () => { throw new Error('HTTP 400 sur https://oauth2.googleapis.com/token : {"error":"invalid_grant"}'); });
  const r = await collect(new Store(":memory:"), g.ctx);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0]!, /jeton Google expiré/);
  assert.ok(!r.warnings[0]!.includes("SECRET-VALEUR"), "aucune valeur de secret dans le message");
});

test("secret absent du serveur : la variable est nommée, aucune valeur n'apparaît", async () => {
  const { GOOGLE_ADS_REFRESH_TOKEN: _r, ...partial } = SECRETS;
  const r = await collect(new Store(":memory:"), fakeGoogle(partial, () => '{"access_token":"at"}').ctx);
  assert.match(r.warnings[0]!, /GOOGLE_ADS_REFRESH_TOKEN absente/);
  assert.ok(!r.warnings[0]!.includes("SECRET-VALEUR"), "aucune valeur de secret dans le message");
});
