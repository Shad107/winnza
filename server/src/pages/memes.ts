// Les mèmes de Winnza : un par semaine, satiriques, sur l'actualité, écrits par l'IA qui gère le site.
// Un mème, c'est une image engendrée par une IA (SANS aucun texte dedans), deux légendes posées dessus par le
// site, un chapeau satirique, et LA VRAIE INFORMATION qui l'a inspiré : un article de presse cité, avec son
// lien. La satire s'affiche comme telle ; le fait réel reste vérifiable.
//
// Les fichiers : content/memes/AAAA-MM-JJ-sujet.json (le texte) et content/memes/AAAA-MM-JJ-sujet.jpg
// (l'image de fond). `checkMeme`, `checkMemeSet` et `checkMemeImage` refusent tout ce qui contredit ces
// règles : la CI les lance sur chaque mème du dépôt (memes.test.ts).
import { z } from "zod";

/** Longueurs maximales, en caractères. */
export const MEME_LIMITS = { title: 90, caption: 64, lead: 400, paragraph: 700, alt: 240, sourceTitle: 160 } as const;
/** Le corps de l'article : de 1 à MEME_BODY_MAX paragraphes. */
export const MEME_BODY_MAX = 5;
/** Au plus un mème tous les MEME_EVERY_DAYS jours. */
export const MEME_EVERY_DAYS = 6;
/** Poids maximal de l'image de fond, en octets. */
export const MEME_IMAGE_MAX_BYTES = 700_000;

const memeSchema = z.strictObject({
  /** le titre satirique, en tête de page */
  title: z.string().min(1),
  /** date de publication, AAAA-MM-JJ, la même que le début du nom de fichier */
  date: z.string(),
  /** la légende du haut et celle du bas, posées sur l'image */
  top: z.string().min(1),
  bottom: z.string().min(1),
  /** le chapeau : écrit comme celui d'une vraie dépêche, au premier degré, sans clin d'œil */
  lead: z.string().min(1),
  /** le corps de l'article, en paragraphes : le même ton de vraie dépêche (faits, citations, chiffres inventés) */
  body: z.array(z.string().min(1)).min(1).max(MEME_BODY_MAX),
  /** la vraie information derrière la blague : l'article qui l'a inspirée */
  source: z.strictObject({ media: z.string().min(1), title: z.string().min(1), url: z.string() }),
  /** ce que montre l'image, pour qui ne la voit pas */
  alt: z.string().min(1),
  /** les personnages du casting qui jouent dans ce mème (content/personnages/<id>.json) */
  characters: z.array(z.string()).min(1),
  /** l'épisode précédent quand l'histoire continue (le nom d'un mème plus ancien), sinon absent */
  previous: z.string().optional(),
  /** la consigne donnée à l'IA d'image, gardée pour qu'on sache d'où vient l'image */
  imagePrompt: z.string().min(1),
});
export type Meme = z.infer<typeof memeSchema> & { slug: string };

/** Lit un mème. Une erreur dit ce qui ne va pas, avec le nom du fichier. */
export function parseMeme(slug: string, raw: string): Meme {
  let json: unknown;
  try { json = JSON.parse(raw); } catch (e) { throw new Error(`mème ${slug} : JSON illisible (${(e as Error).message})`); }
  const r = memeSchema.safeParse(json);
  if (!r.success) throw new Error(`mème ${slug} : ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  return { slug, ...r.data };
}

/** Les règles d'un mème ; chacune rend une phrase lisible quand elle échoue. */
export function checkMeme(m: Meme): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(m.slug)) problems.push("nom de fichier : AAAA-MM-JJ-sujet, en minuscules");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !m.slug.startsWith(m.date)) problems.push("date : AAAA-MM-JJ, la même que le début du nom de fichier");
  const fields = { title: m.title, top: m.top, bottom: m.bottom, lead: m.lead, alt: m.alt, sourceTitle: m.source.title, media: m.source.media };
  const limit = { title: MEME_LIMITS.title, top: MEME_LIMITS.caption, bottom: MEME_LIMITS.caption, lead: MEME_LIMITS.lead, alt: MEME_LIMITS.alt, sourceTitle: MEME_LIMITS.sourceTitle, media: MEME_LIMITS.sourceTitle } satisfies Record<keyof typeof fields, number>;
  const texts: [string, string, number][] = [
    ...(Object.entries(fields) as [keyof typeof fields, string][]).map(([f, t]): [string, string, number] => [f, t, limit[f]]),
    ...m.body.map((t, i): [string, string, number] => [`body[${i}]`, t, MEME_LIMITS.paragraph]),
  ];
  for (const [field, text, max] of texts) {
    if (text.length > max) problems.push(`${field} : ${text.length} caractères (au plus ${max})`);
    if (/[\u2013\u2014]/.test(text)) problems.push(`${field} : tiret cadratin ou demi-cadratin`);
    if (/<[a-z/!]/i.test(text)) problems.push(`${field} : HTML brut`);
  }
  // la source doit être un vrai lien vers un article en ligne, pas une page d'accueil
  let url: URL | null = null;
  try { url = new URL(m.source.url); } catch { /* signalé ci-dessous */ }
  if (!url || url.protocol !== "https:") problems.push("source : une adresse https:// complète");
  else if (url.pathname.length <= 1) problems.push("source : l'adresse de l'article, pas la page d'accueil du média");
  return problems;
}

/** Les règles de l'ensemble : au plus un mème tous les MEME_EVERY_DAYS jours, pas deux fois la même source,
 *  des personnages qui existent au casting, un épisode précédent qui existe et qui est plus ancien. */
export function checkMemeSet(memes: readonly Meme[], cast: readonly Character[]): string[] {
  const problems: string[] = [];
  const ids = new Set(cast.map((c) => c.id));
  const bySlug = new Map(memes.map((m) => [m.slug, m]));
  for (const m of memes) {
    for (const c of m.characters) if (!ids.has(c)) problems.push(`${m.slug} : personnage « ${c} » absent du casting (content/personnages/${c}.json)`);
    if (m.previous !== undefined) {
      const p = bySlug.get(m.previous);
      if (!p) problems.push(`${m.slug} : épisode précédent « ${m.previous} » introuvable`);
      else if (p.date >= m.date) problems.push(`${m.slug} : l'épisode précédent doit être plus ancien`);
    }
  }
  for (const c of cast) {
    if (!bySlug.has(c.firstSeen)) problems.push(`personnage ${c.id} : première apparition « ${c.firstSeen} » introuvable`);
    else if (!bySlug.get(c.firstSeen)!.characters.includes(c.id)) problems.push(`personnage ${c.id} : absent du mème de sa première apparition`);
  }
  const sorted = [...memes].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    const days = (Date.parse(sorted[i]!.date) - Date.parse(sorted[i - 1]!.date)) / 86_400_000;
    if (days < MEME_EVERY_DAYS) problems.push(`${sorted[i - 1]!.slug} puis ${sorted[i]!.slug} : ${days} jour(s) d'écart (au moins ${MEME_EVERY_DAYS})`);
  }
  const seen = new Map<string, string>();
  for (const m of sorted) {
    const prev = seen.get(m.source.url);
    if (prev) problems.push(`${m.slug} : même article source que ${prev}`);
    seen.set(m.source.url, m.slug);
  }
  return problems;
}

/** L'image de fond : un vrai JPEG, pas trop lourd. */
export function checkMemeImage(slug: string, bytes: Uint8Array | null): string[] {
  if (!bytes) return [`${slug} : image ${slug}.jpg absente`];
  const problems: string[] = [];
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) problems.push(`${slug} : l'image n'est pas un JPEG`);
  if (bytes.length > MEME_IMAGE_MAX_BYTES) problems.push(`${slug} : image de ${bytes.length} octets (au plus ${MEME_IMAGE_MAX_BYTES})`);
  return problems;
}

/** Le numéro de semaine ISO d'une date AAAA-MM-JJ (« Semaine 47. »). */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

// Le casting : des personnages inventés, aux noms en jeux de mots, qui reviennent d'une semaine à l'autre et
// tissent un fil entre les histoires. Jamais une personne réelle ni son nom : un personnage incarne un rôle,
// une chose ou une situation (le baril, la pompe, « le ministre du plein »).
const characterSchema = z.strictObject({
  /** le nom en jeu de mots, tel qu'il s'affiche */
  name: z.string().min(1),
  /** ce qu'il incarne, en une phrase */
  role: z.string().min(1),
  /** son caractère, ses manies : ce qui fait qu'on le reconnaît d'un épisode à l'autre */
  traits: z.string().min(1),
  /** son apparence, en anglais, recopiée dans la consigne d'image pour qu'il soit dessiné pareil à chaque fois */
  look: z.string().min(1),
  /** le mème de sa première apparition */
  firstSeen: z.string(),
});
export type Character = z.infer<typeof characterSchema> & { id: string };
export const CHARACTER_LIMITS = { name: 40, role: 160, traits: 300 } as const;

/** Lit un personnage. Une erreur dit ce qui ne va pas, avec le nom du fichier. */
export function parseCharacter(id: string, raw: string): Character {
  let json: unknown;
  try { json = JSON.parse(raw); } catch (e) { throw new Error(`personnage ${id} : JSON illisible (${(e as Error).message})`); }
  const r = characterSchema.safeParse(json);
  if (!r.success) throw new Error(`personnage ${id} : ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  return { id, ...r.data };
}

/** Les règles d'un personnage ; chacune rend une phrase lisible quand elle échoue. */
export function checkCharacter(c: Character): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(c.id)) problems.push(`personnage ${c.id} : nom de fichier en minuscules, chiffres et tirets`);
  for (const f of ["name", "role", "traits"] as const) {
    if (c[f].length > CHARACTER_LIMITS[f]) problems.push(`personnage ${c.id} : ${f} de ${c[f].length} caractères (au plus ${CHARACTER_LIMITS[f]})`);
    if (/[\u2013\u2014]/.test(c[f])) problems.push(`personnage ${c.id} : ${f}, tiret cadratin ou demi-cadratin`);
  }
  return problems;
}
