// Ce que colore la carte des stations : le prix du jour, ou sa variation sur 7 jours.
export const MAP_MODE = { price: 'price', change: 'change' } as const;
export type MapMode = (typeof MAP_MODE)[keyof typeof MAP_MODE];
