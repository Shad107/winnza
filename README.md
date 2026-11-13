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

## Licence

AGPL-3.0. Les données restent sous la licence de leur source (voir `declarations/`).
