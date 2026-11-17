# Winnza : règles de travail

Winnza (https://www.winnza.eu) est un **site satirique** : chaque semaine, l'actualité en un mème, avec une
troupe de personnages inventés qui reviennent d'une semaine à l'autre. Gratuit, sans compte, sans publicité.
Le site est **géré par une IA** : ce fichier est écrit pour elle autant que pour un humain. (Jusqu'au
2026-11-17, Winnza était un site sur le vrai prix de l'énergie : son dernier état est l'étiquette git
`energie-2026-11`.)

## Langue

Tout ce qui s'écrit pour un humain est en **français** : textes du site, commentaires, messages de commit,
comptes rendus. Les **identifiants du code sont en anglais** (fonctions, variables, types, fichiers).

## Écriture

**Le tiret cadratin et le demi-cadratin sont interdits**, partout : site, code, commentaires, commits. Une
incise se met entre virgules ou parenthèses ; une rupture, avec un point ou deux-points ; une énumération,
avec un tiret court en début de ligne. Ne pas remplacer un cadratin par « - » entouré d'espaces : reformuler.
Dans le code, un test qui en a besoin l'écrit en séquence d'échappement (`\u2014` pour le cadratin).

## Architecture

- `content/memes/AAAA-MM-JJ-sujet.json` et `.jpg` : un mème (texte, et image de fond SANS texte engendrée
  par `cd server && npm run meme:image -- <sujet>`). `content/personnages/<id>.json` : le casting. Format et
  règles : `server/src/pages/memes.ts`, vérifiés par `memes.test.ts` (un mème fautif bloque l'intégration
  continue). Réglages de l'image et flux d'actualité : `declarations/memes.json`.
- `web/` : le site (SvelteKit, rendu serveur, Svelte 5, TypeScript). Un seul dessin pour un mème
  (`web/src/lib/server/meme-svg.ts`) : SVG dans la page, PNG pour le partage (`/images/<sujet>.png`).
- `server/` : le socle (TypeScript, SQLite) et ses plugins (`server/src/plugins/<id>/`, contrat
  `server/src/contract.ts`), configurés par `declarations/<plugin>.json` : site (identité), matomo (audience),
  keywords (Keyword Planner) et search-console. Le site y lit son identité et sa mesure d'audience ; l'IA y
  lit les tendances de recherche, et interroge Keyword Planner à la demande
  (`node server/dist/cli.js keyword-ideas "mot" ...`). Une valeur qui décrit une source ou le produit se déclare
  dans `declarations/`, jamais dans le code ; un commit qui modifie une déclaration la fait ressemer en base
  au déploiement (le dépôt fait foi).
- `scripts/` : déploiement (`deploy.sh`, `deploy-when-green.sh`), passage quotidien de l'IA qui gère le site
  (`agent-cron.sh`, `agent-run.sh`, consignes dans `agent-prompt.md`, moteur et budget dans
  `declarations/agent.json`), collecte (`collect-and-alert.sh`).

## Vérifier avant de pousser

```bash
cd server && npm ci && npm run build && npm test     # le socle et ses tests
cd ../web && npm ci && npm run check && npm run build # le site : types et construction
```

Les deux doivent passer. L'intégration continue de GitHub refait exactement cela, plus une recherche de
secrets (gitleaks). **Un commit sur `main` dont l'intégration continue est verte est déployé seul** : le
serveur vient le chercher toutes les 5 minutes, le construit, vérifie que le site répond, et remet la version
précédente sinon. Il n'y a pas d'autre chemin de déploiement.

## Les mèmes

- **Satire, jamais une attaque.** On grossit une situation, un travers, une absurdité réelle. Jamais le nom
  d'une personne réelle ni une déformation reconnaissable de son nom ; jamais une personne réelle dessinée.
  Une personnalité devient un personnage inventé qui joue son rôle. Rien sur la religion, l'origine, le
  handicap, la sexualité ; rien qui moque des victimes.
- **La vraie information est citée** sous chaque mème (média, titre, adresse de l'article), et elle a été
  lue et vérifiée dans un second média avant publication. Le chapeau dit en une phrase ce qui est vrai.
- **Le casting fait le fil** : des noms en jeux de mots, un caractère et une apparence qui ne changent pas
  d'un épisode à l'autre ; `previous` relie un mème à l'épisode qu'il continue.
- Au plus un mème tous les 6 jours ; un mème publié ne se réécrit pas, une erreur se corrige par un nouveau
  commit qui la signale.

## L'état du site

https://www.winnza.eu/etat.json : le dernier déploiement, les dernières collectes, la date du dernier relevé
de chaque donnée.

## Règles de code

- **`satisfies`, pas `as`** quand on peut vérifier. Une assertion fait taire le compilateur.
- **Énumérations, pas de chaînes écrites à la main** pour les valeurs du domaine :
  `export const X = { a: "a" } as const;` puis `X.a`.
- **Tout contrôle doit savoir échouer, et être appelé.** Chaque contrôle a un test « témoin » qui le fait
  échouer ; retirer son appel doit faire échouer un test.
- **Une source qui change de format doit faire échouer la collecte**, jamais afficher un chiffre faux. Les
  colonnes et champs se repèrent par leur nom, déclaré.
- **Une source d'appoint** (non indispensable) se déclare `optional` : sa panne avertit sans tout arrêter.
- **Aucun fait inventé présenté comme vrai** : la blague est inventée et l'affiche ; le fait réel est cité.
- **Un composant** ne varie que par son contenu : même cadre, même disposition partout.
- Prendre la **dernière version** de chaque dépendance, et suivre ses changements plutôt que redescendre.

## Secrets

**Aucun secret dans le dépôt**, jamais : ni clé, ni jeton, ni mot de passe, ni dans un test, ni dans un
message. Les secrets vivent sur le serveur (`.env` pour le site, `collect.env` pour la collecte) ; le code
ne connaît que le NOM de la variable. Le dépôt est public.

## Commits

Messages en français, une première ligne qui dit ce qui change, puis le pourquoi. **Aucune ligne
d'attribution** (`Co-Authored-By`, `Claude-Session` ou autre). Un commit fait une chose.
