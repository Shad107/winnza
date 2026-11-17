import { appearances, cast, memePath, memes, memeWeek } from '#lib/server/memes.ts';

// Le casting : chaque personnage, ce qu'il incarne, ses manies, et les mèmes où il a joué.
export const load = () => ({
  hasMemes: memes.length > 0,
  cast: cast.map((c) => ({
    id: c.id, name: c.name, role: c.role, traits: c.traits,
    episodes: appearances(c.id).map((m) => ({ title: m.title, week: memeWeek(m), href: memePath(m.slug) })),
  })),
});
