# Winnza : règles de travail

Winnza (https://www.winnza.eu) est le vrai prix de l'énergie : carburant, électricité, coût aux 100 km.
Gratuit, sans compte, sans publicité ni lien affilié, sources publiques et gratuites seulement. Le site est
**géré par une IA** : ce fichier est écrit pour elle autant que pour un humain.

## Langue

Tout ce qui s'écrit pour un humain est en **français** : textes du site, commentaires, messages de commit,
comptes rendus. Les **identifiants du code sont en anglais** (fonctions, variables, types, fichiers).

## Écriture

**Le tiret cadratin et le demi-cadratin sont interdits**, partout : site, code, commentaires, commits. Une
incise se met entre virgules ou parenthèses ; une rupture, avec un point ou deux-points ; une énumération,
avec un tiret court en début de ligne. Ne pas remplacer un cadratin par « - » entouré d'espaces : reformuler.
Dans le code, un test qui en a besoin l'écrit en séquence d'échappement (`—`).

## Architecture

- `server/` : le socle (TypeScript, SQLite). Tout ce que le site affiche entre en base par un **plugin**
  (`server/src/plugins/<id>/`), déclaré dans `server/src/plugins/builtins.ts`. Un plugin déclare ses
  sources, séries, instantanés et réglages, et ses collecteurs. Contrat : `server/src/contract.ts`.
- `declarations/<plugin>.json` : la configuration de chaque plugin (adresses des sources, colonnes, pays,
  limites). **Une valeur qui décrit une source ou le produit se déclare là, jamais dans le code.**
- `declarations/anchors.json` : des valeurs publiées par des tiers que nos calculs doivent retrouver. Une
  ancre violée arrête la collecte. Toute nouvelle série calculée mérite son ancre.
- `server/src/pages/*.ts` : les données de chaque page, calculées depuis la base seulement, testées.
- `web/` : le site (SvelteKit, rendu serveur, Svelte 5, TypeScript). Il ne lit QUE la base.
- `scripts/` : collecte quotidienne (`collect-and-alert.sh`), déploiement (`deploy.sh`,
  `deploy-when-green.sh`).

## Vérifier avant de pousser

```bash
cd server && npm ci && npm run build && npm test     # le socle et ses tests
cd ../web && npm ci && npm run check && npm run build # le site : types et construction
```

Les deux doivent passer. L'intégration continue de GitHub refait exactement cela, plus une recherche de
secrets (gitleaks). **Un commit sur `main` dont l'intégration continue est verte est déployé seul** : le
serveur vient le chercher toutes les 5 minutes, le construit, vérifie que le site répond, et remet la version
précédente sinon. Il n'y a pas d'autre chemin de déploiement.

## L'état du site

https://www.winnza.eu/etat.json : les dernières collectes (réussite, erreurs, sources d'appoint absentes),
le dernier déploiement, la date du dernier relevé de chaque donnée, les pages retirées faute de données.
Une date qui ne bouge plus signale une source cassée.

## Règles de code

- **`satisfies`, pas `as`** quand on peut vérifier. Une assertion fait taire le compilateur.
- **Énumérations, pas de chaînes écrites à la main** pour les valeurs du domaine :
  `export const X = { a: "a" } as const;` puis `X.a`.
- **Tout contrôle doit savoir échouer, et être appelé.** Chaque contrôle a un test « témoin » qui le fait
  échouer ; retirer son appel doit faire échouer un test.
- **Une source qui change de format doit faire échouer la collecte**, jamais afficher un chiffre faux. Les
  colonnes et champs se repèrent par leur nom, déclaré.
- **Une source d'appoint** (non indispensable) se déclare `optional` : sa panne avertit sans tout arrêter.
- **Aucun chiffre inventé** sur le site : chaque nombre vient de la base, avec sa source et sa date.
- **Un composant** ne varie que par son contenu : même cadre, même disposition partout.
- Prendre la **dernière version** de chaque dépendance, et suivre ses changements plutôt que redescendre.

## Secrets

**Aucun secret dans le dépôt**, jamais : ni clé, ni jeton, ni mot de passe, ni dans un test, ni dans un
message. Les secrets vivent sur le serveur (`.env` pour le site, `collect.env` pour la collecte) ; le code
ne connaît que le NOM de la variable. Le dépôt est public.

## Commits

Messages en français, une première ligne qui dit ce qui change, puis le pourquoi. **Aucune ligne
d'attribution** (`Co-Authored-By`, `Claude-Session` ou autre). Un commit fait une chose.
