// Les mèmes (content/memes/), intégrés au moment de la construction : un mème publié passe donc par
// l'intégration continue, qui vérifie ses règles (server/src/pages/memes.test.ts).
import { isoWeek, parseCharacter, parseMeme, type Character, type Meme } from '@winnza/core/pages/memes.js';

const DIR = '../../../../content/memes/';
const texts = import.meta.glob('../../../../content/memes/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** l'image de fond servie telle quelle (fichier statique, empreinte dans le nom) */
const urls = import.meta.glob('../../../../content/memes/*.jpg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
/** la même, en data: URI, pour l'assembler avec les légendes (rendu de l'image à partager) */
const inline = import.meta.glob('../../../../content/memes/*.jpg', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;

/** Tous les mèmes, du plus récent au plus ancien. */
export const memes: readonly Meme[] = Object.entries(texts)
  .map(([path, raw]) => parseMeme(path.slice(DIR.length).replace(/\.json$/, ''), raw))
  .sort((a, b) => b.date.localeCompare(a.date));

const CAST_DIR = '../../../../content/personnages/';
const castTexts = import.meta.glob('../../../../content/personnages/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** Le casting, par ordre alphabétique de nom. */
export const cast: readonly Character[] = Object.entries(castTexts)
  .map(([path, raw]) => parseCharacter(path.slice(CAST_DIR.length).replace(/\.json$/, ''), raw))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
export const findCharacter = (id: string): Character | null => cast.find((c) => c.id === id) ?? null;
/** Les mèmes où joue un personnage, du plus récent au plus ancien. */
export const appearances = (id: string): readonly Meme[] => memes.filter((m) => m.characters.includes(id));

/** la vidéo gag, quand le mème en a une (fichier statique, empreinte dans le nom) */
const videos = import.meta.glob('../../../../content/memes/*.mp4', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
export const memeVideoUrl = (slug: string): string | null => videos[`${DIR}${slug}.mp4`] ?? null;

export const findMeme = (slug: string): Meme | null => memes.find((m) => m.slug === slug) ?? null;
export const memeImageUrl = (slug: string): string | null => urls[`${DIR}${slug}.jpg`] ?? null;
export const memeImageInline = (slug: string): string | null => inline[`${DIR}${slug}.jpg`] ?? null;
export const memeWeek = (m: Meme): number => isoWeek(m.date);

/** L'adresse publique du mème et celle de son image à partager (légendes comprises). */
export const memePath = (slug: string) => `/memes/${slug}`;
export const memePngPath = (slug: string) => `/images/${slug}.png`;
/** l'aperçu pour les réseaux sociaux (1200 × 630) */
export const memeSharePath = (slug: string) => `/partage/${slug}.png`;
/** l'image du dernier mème, à une adresse fixe (partage de l'accueil, vérification du déploiement) */
export const LATEST = 'dernier';
