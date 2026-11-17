import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkCharacter, checkMeme, checkMemeImage, checkMemeSet, isoWeek, MEME_IMAGE_MAX_BYTES, parseCharacter, parseMeme, type Character, type Meme } from "./memes.js";

const GOOD = {
  title: "Le baril prend l'ascenseur, le gazole prend l'escalier",
  date: "2026-11-17",
  top: "Le baril : moins un tiers en cinq semaines",
  bottom: "La pompe : on arrive, on arrive",
  lead: "Les automobilistes sont priés de patienter : la baisse est en route, à pied.",
  body: ["Selon nos informations, la baisse a été aperçue mardi dans l'escalier.", "Elle n'a pas souhaité s'exprimer."],
  source: { media: "Exemple Info", title: "Le pétrole recule", url: "https://exemple.fr/economie/petrole-recule" },
  alt: "Un baril dans un ascenseur, une pompe dans un escalier.",
  characters: ["barry"],
  imagePrompt: "no text",
};
type Fields = Omit<typeof GOOD, "source"> & { source: { media: string; title: string; url: string }; previous?: string };
const meme = (over: Partial<Fields> = {}, slug = "2026-11-17-ascenseur"): Meme => parseMeme(slug, JSON.stringify({ ...GOOD, ...over }));
const problems = (over: Partial<Fields>) => checkMeme(meme(over)).join(" | ");
const src = (url: string) => ({ ...GOOD.source, url });

test("mème : un mème conforme passe", () => {
  assert.deepEqual(checkMeme(meme()), []);
});

test("mème : trop long, tiret cadratin, HTML, source absente ou page d'accueil, mauvais nom ou date : refusés (témoins)", () => {
  assert.match(problems({ top: "x".repeat(65) }), /top : 65 caractères/);
  assert.match(problems({ lead: "Un recul \u2014 net." }), /lead : tiret/);
  assert.match(problems({ body: ["ok", "x".repeat(701)] }), /body\[1\] : 701 caractères/);
  assert.match(problems({ body: ["Un recul \u2014 net."] }), /body\[0\] : tiret/);
  assert.match(problems({ title: "<b>gras</b>" }), /title : HTML brut/);
  assert.match(problems({ source: src("http://exemple.fr/article") }), /https/);
  assert.match(problems({ source: src("pas une adresse") }), /https/);
  assert.match(problems({ source: src("https://exemple.fr/") }), /pas la page d'accueil/);
  assert.match(checkMeme(meme({}, "Ascenseur")).join(), /nom de fichier/);
  assert.match(checkMeme(meme({ date: "2026-11-18" })).join(), /date/);
});

test("mème : fichier illisible, champ manquant ou en trop : erreur qui nomme le fichier", () => {
  assert.throws(() => parseMeme("x", "{"), /mème x : JSON illisible/);
  assert.throws(() => parseMeme("x", JSON.stringify({ ...GOOD, source: undefined })), /mème x : source/);
  assert.throws(() => parseMeme("x", JSON.stringify({ ...GOOD, extra: 1 })), /mème x/);
  assert.throws(() => parseMeme("x", JSON.stringify({ ...GOOD, body: [] })), /mème x : body/);
});

test("mèmes : au plus un par semaine, jamais deux fois le même article (témoins)", () => {
  const a = meme({ date: "2026-11-10", source: src("https://exemple.fr/a") }, "2026-11-10-a");
  assert.deepEqual(checkMemeSet([a, meme({}, "2026-11-17-b")], CAST), []);
  assert.match(checkMemeSet([meme({ date: "2026-11-15", source: src("https://exemple.fr/a") }, "2026-11-15-a"), meme({}, "2026-11-17-b")], CAST).join(), /2 jour\(s\) d'écart/);
  assert.match(checkMemeSet([meme({ date: "2026-11-10" }, "2026-11-10-a"), meme({}, "2026-11-17-b")], CAST).join(), /même article source/);
});

const CAST = [{ id: "barry", name: "Barry", role: "r", traits: "t", look: "l", firstSeen: "2026-11-10-a" }];
const character = (over: Partial<Omit<Character, "id">> = {}, id = "barry"): Character => parseCharacter(id, JSON.stringify({
  name: "Barry Lachute", role: "Le baril.", traits: "Panique pour un rien.", look: "a barrel", firstSeen: "2026-11-10-a", ...over }));

test("casting : personnages inconnus, première apparition fausse, épisode précédent introuvable ou plus récent : refusés (témoins)", () => {
  const first = meme({ date: "2026-11-10", source: src("https://exemple.fr/a") }, "2026-11-10-a");
  const cast = [character()];
  assert.deepEqual(checkMemeSet([first, meme({ previous: "2026-11-10-a" }, "2026-11-17-b")], cast), []);
  assert.match(checkMemeSet([first, meme({ characters: ["inconnu"] }, "2026-11-17-b")], cast).join(), /« inconnu » absent du casting/);
  assert.match(checkMemeSet([first], [character({ firstSeen: "2026-01-01-x" })]).join(), /première apparition/);
  assert.match(checkMemeSet([meme({ date: "2026-11-10", source: src("https://exemple.fr/a"), characters: ["autre"] }, "2026-11-10-a")], [...cast, character({}, "autre")]).join(), /barry : absent du mème de sa première apparition/);
  assert.match(checkMemeSet([first, meme({ previous: "2026-01-01-x" }, "2026-11-17-b")], cast).join(), /épisode précédent « 2026-01-01-x » introuvable/);
  assert.match(checkMemeSet([meme({ date: "2026-11-10", source: src("https://exemple.fr/a"), previous: "2026-11-17-b" }, "2026-11-10-a"), meme({}, "2026-11-17-b")], cast).join(), /plus ancien/);
});

test("casting : un personnage conforme passe ; nom trop long, tiret cadratin, mauvais nom de fichier : refusés (témoins)", () => {
  assert.deepEqual(checkCharacter(character()), []);
  assert.match(checkCharacter(character({ name: "x".repeat(41) })).join(), /name de 41 caractères/);
  assert.match(checkCharacter(character({ traits: "Calme \u2014 ou pas." })).join(), /tiret/);
  assert.match(checkCharacter(character({}, "Barry")).join(), /nom de fichier/);
  assert.throws(() => parseCharacter("x", JSON.stringify({ name: "X" })), /personnage x : role/);
});

test("mème : image absente, pas un JPEG, ou trop lourde : refusée (témoins)", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  assert.deepEqual(checkMemeImage("a", jpeg), []);
  assert.match(checkMemeImage("a", null).join(), /absente/);
  assert.match(checkMemeImage("a", new Uint8Array([0x89, 0x50, 0x4e, 0x47])).join(), /pas un JPEG/);
  const big = new Uint8Array(MEME_IMAGE_MAX_BYTES + 1); big.set(jpeg);
  assert.match(checkMemeImage("a", big).join(), /octets/);
});

test("numéro de semaine ISO", () => {
  assert.equal(isoWeek("2026-11-17"), 47);
  assert.equal(isoWeek("2026-01-01"), 1);
  assert.equal(isoWeek("2027-01-01"), 53);
});

// Les mèmes du dépôt : chacun respecte les règles, l'ensemble aussi. C'est ce test qui bloque un mème fautif.
const DIR = join(process.cwd(), "..", "content", "memes");
const CAST_DIR = join(process.cwd(), "..", "content", "personnages");
test("mèmes et casting du dépôt : tous conformes, chaque mème avec son image", () => {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];
  const memes = files.map((f) => parseMeme(f.replace(/\.json$/, ""), readFileSync(join(DIR, f), "utf8")));
  const cast = (existsSync(CAST_DIR) ? readdirSync(CAST_DIR).filter((f) => f.endsWith(".json")) : [])
    .map((f) => parseCharacter(f.replace(/\.json$/, ""), readFileSync(join(CAST_DIR, f), "utf8")));
  const all = [
    ...memes.flatMap((m) => checkMeme(m).map((p) => `${m.slug} : ${p}`)),
    ...cast.flatMap(checkCharacter),
    ...memes.flatMap((m) => { const img = join(DIR, `${m.slug}.jpg`); return checkMemeImage(m.slug, existsSync(img) ? readFileSync(img) : null); }),
    ...checkMemeSet(memes, cast),
  ];
  for (const f of existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".jpg")) : []) {
    if (!files.includes(f.replace(/\.jpg$/, ".json"))) all.push(`${f} : image sans mème`);
  }
  assert.deepEqual(all, []);
});
