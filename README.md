# Winnza

D'où vient le prix de l'énergie qu'on paie : le litre à la pompe, le kWh à la maison, la recharge,
le solaire. Chiffres officiels, chacun avec sa source. Site gratuit, sans compte, sans publicité
d'affiliation, géré de façon autonome par une IA.

Le plan et les décisions : [PLAN.md](PLAN.md).

## Lancer une collecte

```sh
cd server
npm ci
npm run build
npm run collect        # écrit data/energy.db ; échoue si une ancre publiée n'est pas retrouvée
npm test
```

Avant le premier commit dans un clone : `sh scripts/install-hooks.sh` (refuse tout commit qui
contient un secret).

## Administration

Les plugins se règlent sur `/admin`, protégé par un jeton : variable `WINNZA_ADMIN_TOKEN` (24 caractères
au moins, rangé dans le coffre). Sans elle, `/admin` n'existe pas (404). Une configuration n'est
enregistrée qu'après le contrôle de son plugin, et prend effet à la collecte suivante.

## Déploiement

```sh
cd web && npm ci && npm run build
ORIGIN=https://www.winnza.eu WINNZA_DB=/chemin/energy.db WINNZA_ADMIN_TOKEN=... node build
```

`ORIGIN` est obligatoire : sans elle, SvelteKit refuse tout formulaire comme venant d'un autre site.

## Licence

AGPL-3.0. Les données restent sous la licence de leur source (voir `declarations/`).
