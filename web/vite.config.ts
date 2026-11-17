// Site Winnza : SvelteKit rendu par le serveur (adaptateur node), comme OpenCloudApp. Le rendu serveur
// est voulu : le Winnza précédent, rendu côté navigateur, était invisible pour les moteurs de recherche.
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter() })],
  server: { host: '0.0.0.0', port: 4322, fs: { allow: [repoRoot] } },
  ssr: {
    // le socle est empaqueté dans le serveur ; better-sqlite3 et resvg (natifs) restent externes
    noExternal: ['@winnza/core'],
    external: ['better-sqlite3', '@resvg/resvg-js'],   // resvg : rendu natif des images des mèmes
  },
});
