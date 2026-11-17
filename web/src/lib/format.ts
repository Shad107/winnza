// Les dates du site, en toutes lettres : « 17 novembre 2026 », « 1er décembre 2026 ».
const dateLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const longDate = (iso: string): string => dateLong.format(new Date(iso + 'T00:00:00Z')).replace(/^1 /, '1er ');
