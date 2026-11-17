import { memes } from '#lib/server/memes.ts';
import { memeCard } from '#lib/server/meme-card.ts';

// L'accueil : le mème de la semaine, puis tous les précédents.
export const load = () => {
  const cards = memes.map((m) => memeCard(m.slug)).filter((c) => c !== null);
  return { latest: cards[0] ?? null, previous: cards.slice(1) };
};
