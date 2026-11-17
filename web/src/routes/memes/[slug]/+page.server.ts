import { error } from '@sveltejs/kit';
import { memeCard } from '#lib/server/meme-card.ts';

export const load = ({ params }) => {
  const meme = memeCard(params.slug);
  if (!meme) error(404, 'Mème introuvable');
  return { meme };
};
