# Plan

Nom : **Winnza**, sur le domaine winnza.eu (déjà détenu ; ses sous-domaines techniques, Matomo,
console Coolify, recherche, restent en place). Le nom reprend celui du projet loto abandonné en 2026 :
code et dépôts de l'époque archivés, rien n'en est réutilisé.

## Ce que fait le site

Montrer d'où vient le prix de l'énergie qu'on paie au quotidien, chiffres officiels à l'appui :
le litre à la pompe, le kWh à la maison, la recharge, le solaire. Et répondre à la question que se pose
tout le monde : combien me coûtent 100 km, selon ma motorisation.

L'idée de départ : en juillet 2008 le Brent était à son record (environ 145 $), et le gazole coûtait
1,43 €. En novembre 2026 le baril est plus bas, et le gazole coûte 2,18 €. Aucun site ne le montre en
continu. Premier calcul sur les données officielles (bulletin pétrolier européen, Brent, BCE) :

| gazole, €/L | juillet 2008 | novembre 2026 | écart |
|---|---|---|---|
| prix à la pompe | 1,43 | 2,18 | +0,75 |
| dont pétrole brut | 0,54 | 0,56 | +0,03 |
| dont raffinage, transport, distribution | 0,23 | 0,64 | +0,42 |
| dont accise | 0,43 | 0,61 | +0,18 |
| dont TVA | 0,23 | 0,36 | +0,13 |

## Décisions (2026-11-13)

- **Gratuit, sans compte.** Le site montre des pages ; il n'expose pas d'API.
- **Pas de lien d'affiliation, jamais.** Un site qui dénonce des marges ne touche pas de commission.
- **Sources gratuites uniquement.** Sans clé de préférence ; une clé gratuite est acceptée (ENTSO-E,
  RTE, EIA). Les clés vivent dans le coffre, jamais dans le dépôt.
- **Chaque chiffre affiché porte sa source, sa date et un lien.**
- **Site géré de façon autonome par une IA, et c'est affiché clairement** sur le site. Ce pilotage
  (maintenance, évolution du code, contenu) sera lui-même un plugin, dans un budget d'API d'environ
  200 € par mois.
- **Code public, licence AGPL-3.0**, sur le compte Shad107. Le scanner de secrets tourne avant chaque
  commit et en CI : le projet précédent avait 60 secrets dans son historique.
- **Même technique qu'OpenCloudApp** : SvelteKit en rendu serveur, Svelte 5, Vite, TypeScript, SQLite.
  Le rendu côté client avait plombé le référencement de Winnza.
- **Design soigné d'abord** : maquettes validées avant d'écrire les pages.

## Architecture

Un socle et des plugins, sur le modèle d'OpenCloudApp : un plugin reçoit une `PluginApi` et y déclare
ses sources, ses séries, ses collecteurs et ses dérivations (`server/src/contract.ts`).

Une collecte (`server/src/runner.ts`) télécharge, écrit en base, calcule les dérivations, puis vérifie
les **ancres** : des valeurs publiées par des tiers (`declarations/anchors.json`) que nos séries
doivent retrouver. Si une ancre ne colle pas, rien n'est écrit et la collecte échoue. On ne publie
pas un chiffre faux.

Ce qui décrit une source (adresse, liste de pays, de produits) se déclare dans `declarations/`, pas
dans le code.

## Étapes

1. **Socle de données** : fait le 2026-11-13. Collecteurs carburants (bulletin européen, Brent FRED,
   euro/dollar BCE), décomposition de chaque litre pour 27 pays et 4 produits depuis 2005, 8 ancres
   (dont la décomposition officielle de la Banque de France de septembre 2021, retrouvée à 0,3 centime),
   10 tests, dont un témoin de mutation sur l'appel des ancres.
2. **Plugin carburants, côté pages** : fait le 2026-11-13 (site SvelteKit en rendu serveur, `web/`).
   Le site ne lit QUE la base ; tout y entre par un plugin (carburants, charges cachées, site).
   Plugin SEO (`web/src/lib/plugins/seo`) : titre, description, canonique, Open Graph, données
   structurées (FAQPage), `sitemap.xml`, `robots.txt`. Contenu prévu à l'origine : la barre « où va mon litre », 2008 contre aujourd'hui (baril en
   dollars, en euros, en euros constants), comparaison européenne, prix des stations (open data
   officiel : gazole, SP95, E10, SP98, E85, GPL).
3. **Plugin électricité** : même barre de décomposition pour le kWh (énergie, réseau, taxes, TVA),
   tarifs réglementés CRE depuis 2012, Tempo, prix de gros ENTSO-E (l'équivalent du baril).
4. **Coût aux 100 km** : toutes les motorisations côte à côte. Essence, gazole, E85, GPL, GNV,
   hydrogène, hybride, électrique à la maison (Base, heures creuses, Tempo), sur borne, avec ses
   propres panneaux solaires (PVGIS). GNV et hydrogène n'ont pas de flux de prix public : prix de
   référence déclarés avec leur source et leur date, affichés comme tels.
5. **Prévision « plein maintenant ou j'attends ? »**, seulement si elle passe un test sur l'historique.
6. **Plugin de gestion autonome par IA.**
7. **Plugin Keyword Planner** : les phrases que les gens tapent vraiment (volume, tendance) pilotent
   les titres, les questions fréquentes et les pages à créer. Le contenu parle leurs mots.

## En ligne (2026-11-14)

**https://www.winnza.eu** (winnza.eu redirige vers www). VPS OVH 146.59.45.179, utilisateur `ubuntu` :
dépôt cloné dans `~/winnza`, `docker compose up -d --build` ; conteneur `winnza-web` sur le réseau `coolify`,
servi par le Caddy existant (`/root/winnza-proxy/Caddyfile`, bloc ajouté en fin de fichier, fichier monté
seul : l'ÉTENDRE, jamais le remplacer). Base dans le volume `winnza-data`. Collecte chaque jour à 6 h 30
(crontab root, journal `/var/log/winnza-collect.log`). Jeton d'administration au coffre, entrée
« Winnza (www.winnza.eu) », copié dans `~/winnza/.env`. Mettre à jour : `git pull && docker compose up -d --build`.

**14/11, suite** : site en cinq pages (le plein, taxes, depuis 2005, prix du baril, Europe) ; plugin stations
(6 carburants du jour, France et 96 départements) ; plugin matomo (suivi serveur sans cookie, site 1 de
matomo.winnza.eu, IP anonymisées, IP d'Olivier exclues ; MATOMO_TOKEN dans `~/winnza/.env`) ; alerte mail
au changement d'état de la collecte (`scripts/collect-and-alert.sh`, identifiants de la sonde externe).

**14/11, nuit** : prévision (/prevision), carte des départements, carte zoomable des stations avec noms
(OpenStreetMap) et « Autour de moi ». **Historique des prix station par station** gardé chaque jour
(instantané `stations.prices`, 10 ans, environ 330 Mo par an) : nos propres moyennes France, 13 régions et
96 départements en sont calculées (identiques à 4 décimales près à celles de la source le 14/11). La
moyenne par ville se calculera du même historique, pour une page par ville.

## Moteur de plugins partagé avec OpenCloudApp (décision du 2026-11-13)

Winnza n'a aujourd'hui que le principe d'OpenCloudApp (`register(api)`) : ses plugins sont branchés en
dur et ses réglages viennent de fichiers. Décision : **extraire le moteur de plugins d'OpenCloudApp
dans un dépôt public partagé chez Isno-Open (AGPL)**, utilisé par les deux projets.

- **Partagé, le moteur seulement** : format d'un plugin, chargement depuis des dossiers (un plugin en
  échec ne bloque pas), réglages déclarés stockés en base avec leur écran, puis administration,
  catalogues, installation et mise à jour.
- **Les spécificités restent dans chaque projet**, comme extensions de l'`api` : comptes et boîtiers
  pour OpenCloudApp ; sources, séries, collecteurs et dérivations pour Winnza.
- **Versions figées** par projet ; **Winnza migre en premier** ; OpenCloudApp seulement quand son test
  de bout en bout passe sur le moteur partagé.
- Ordre : 1) format et chargeur, Winnza branché dessus, ses fichiers JSON deviennent des réglages en
  base ; 2) écran de réglages et administration ; 3) migration d'OpenCloudApp.
- **Étape 1 faite le 2026-11-13** : https://github.com/Isno-Open/OpenPluginHost (v0.1.0). Winnza charge
  ses plugins par ce moteur, version figée. Chaque plugin lit ses réglages en base (`plugin.<id>`) ;
  `declarations/` n'initialise qu'une base neuve, `node dist/cli.js seed <plugin>` recharge un plugin
  depuis son fichier, `node dist/cli.js plugins` liste les plugins. Un plugin en échec est écarté sans
  rien laisser au registre ; ses ancres sont signalées comme non vérifiées.
- **Étape 2 faite le 2026-11-14** : OpenPluginHost v0.2.0 apporte l'écran de réglages générique
  (`SettingsForm.svelte`) et un type de réglage `json`. Winnza a son administration (`/admin`, jeton
  `WINNZA_ADMIN_TOKEN`) : liste des plugins, activer ou éteindre, réglages validés par le plugin avant
  d'atteindre la base. Testé de bout en bout dans un navigateur. Winnza devient la démonstration
  technique du moteur partagé (idée d'Olivier).
- Si le moteur s'avère trop lié aux comptes ou aux boîtiers, on s'arrête et on en reparle.

Ensuite : plugin stations (E10, SP98, E85, prix quotidiens), puis plugin prévision (validé sur
l'historique avant publication), puis électricité, recharge et solaire.

## Ce que disent les mots-clés (Keyword Planner, France, 2026-11-13)

| Requête | Recherches/mois | Ce qu'on en fait |
|---|---|---|
| prix du baril | 368 000 | personne ne le relie au prix à la pompe : c'est notre angle |
| prix du baril de pétrole | 135 000 | idem |
| prix essence luxembourg | 27 100 | page par pays voisin |
| taxes carburant | 14 800 | décomposition, détail des taxes |
| prix gasoil espagne | 14 800 | page par pays voisin |
| prix carburant belgique | 8 100 | page par pays voisin |
| ticpe | 5 400 | expliquer l'accise (ex-TICPE) |
| le carburant va-t-il baisser | 880 (×12 depuis mars) | la prévision, quand elle sera validée |

## Design (retours d'Olivier sur la première maquette)

- **Grand public** : partir du plein en euros (« où passe l'argent de votre plein »), pas du prix
  au litre ; trois parts en mots simples : le pétrole, la raffinerie et la station, l'État.
- **Graphiques modernes** : palette validée pour les daltoniens, traits fins, fonds légers,
  info-bulle au survol et au clavier, mode sombre.
- **Un vrai en-tête et un vrai pied de page** ; la mention « site géré par une IA » dans le pied de page.

## Sources vérifiées (sans clé, 2026-11-13)

| Donnée | Source | Depuis |
|---|---|---|
| Prix TTC, HT, TVA, accise des carburants, 27 pays | Bulletin pétrolier européen | 2005 |
| Prix de chaque station française | data.economie.gouv.fr, donnees.roulez-eco.fr | 2007 |
| Brent | FRED (d'après l'EIA) | 1987 |
| Euro/dollar | BCE | 1999 |
| Tarifs réglementés d'électricité | CRE (open data) | 2012 |
| Composantes du prix de l'électricité | Eurostat (nrg_pc_204_c) | 2007 |
| Couleur Tempo | api-couleur-tempo.fr | |
| Production solaire selon le lieu | PVGIS (Commission, JRC) | |
| Inflation | Eurostat | |

À créer (clé gratuite, au nom d'Olivier) : ENTSO-E, RTE data, EIA.
