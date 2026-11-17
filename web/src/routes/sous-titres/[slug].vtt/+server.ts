// Les sous-titres d'une vidéo gag (WebVTT) : la vidéo n'a pas de dialogue écrit, la piste décrit donc la
// scène et rappelle les légendes du mème, pour qui ne voit pas ou n'entend pas la vidéo.
import { error } from '@sveltejs/kit';
import { findMeme, memeVideoUrl } from '#lib/server/memes.ts';

/** une piste couvre toute la vidéo, quelle que soit sa durée réelle (au plus une minute) */
const END = '00:01:00.000';

export const GET = ({ params }) => {
  const m = findMeme(params.slug);
  if (!m || !memeVideoUrl(params.slug)) error(404, 'Sous-titres introuvables');
  const vtt = `WEBVTT\n\n00:00:00.000 --> ${END}\n[Satire, personnes inventées] ${m.alt}\n${m.top} / ${m.bottom}\n`;
  return new Response(vtt, { headers: { 'content-type': 'text/vtt; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
