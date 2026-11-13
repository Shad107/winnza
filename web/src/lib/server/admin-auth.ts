// Accès à l'administration. Winnza n'a pas de comptes : un seul jeton secret, donné au serveur par la
// variable WINNZA_ADMIN_TOKEN (rangé dans le coffre). Sans jeton, l'administration n'existe pas (404).
// Une fois le jeton saisi, le navigateur garde un cookie signé (HMAC du jeton), jamais le jeton lui-même.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'winnza_admin';
export const ADMIN_PATH = '/admin';
export const ADMIN_LOGIN_PATH = '/admin/connexion';

const token = (): string | null => {
  const t = process.env.WINNZA_ADMIN_TOKEN;
  return t && t.length >= 24 ? t : null;   // un jeton trop court ne protège rien : l'administration reste fermée
};

export const adminEnabled = (): boolean => token() !== null;

const signature = (t: string): string => createHmac('sha256', t).update('winnza-admin-v1').digest('hex');

const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Le jeton saisi est-il le bon ? Rend la valeur du cookie à poser, ou null. */
export function login(input: string): string | null {
  const t = token();
  return t && same(input, t) ? signature(t) : null;
}

/** Le cookie présenté ouvre-t-il l'administration ? */
export function isAdmin(cookie: string | undefined): boolean {
  const t = token();
  return !!t && !!cookie && same(cookie, signature(t));
}
