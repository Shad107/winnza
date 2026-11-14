#!/usr/bin/env bash
# Fichiers de la carte des stations, servis par Winnza lui-même (aucun appel du navigateur à un tiers) :
#   - france.pmtiles : fond de carte OpenStreetMap de la France, au zoom le plus fin (environ 10 Go),
#     extrait de la construction quotidienne publique de Protomaps ;
#   - fonts/ : polices des noms de lieux (Noto Sans, licence OFL), découpées par plage de caractères ;
#   - sprites/ : icônes du fond de carte (clair et sombre).
#
# Usage : scripts/fetch-map.sh <dossier> [AAAAMMJJ]    (dossier monté dans le conteneur en /map)
# Sans date : la construction la plus récente. Le fichier précédent reste en place jusqu'à la fin.
set -euo pipefail
DIR=${1:?usage : fetch-map.sh <dossier> [AAAAMMJJ]}
PMTILES_VERSION=1.31.2
BBOX=${BBOX:--5.6,41.2,9.8,51.3}   # métropole et Corse (une zone réduite pour essayer en local)
mkdir -p "$DIR" && cd "$DIR"

if [ ! -x ./pmtiles ]; then
  curl -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz" | tar xz pmtiles
fi
BUILD=${2:-$(curl -fsS https://build-metadata.protomaps.dev/builds.json | python3 -c "import sys,json; print(json.load(sys.stdin)[-1]['key'].removesuffix('.pmtiles'))")}
if [ "$(cat france.build 2>/dev/null)" = "$BUILD" ] && [ -s france.pmtiles ]; then
  echo "fond de carte déjà à la construction $BUILD"
else
  ./pmtiles extract "https://build.protomaps.com/${BUILD}.pmtiles" france.pmtiles.new --bbox="$BBOX" --download-threads=4
  mv france.pmtiles.new france.pmtiles
  echo "$BUILD" > france.build
fi

TMP=$(mktemp -d)
curl -fsSL https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.tar.gz | tar xz -C "$TMP"
rm -rf fonts sprites && mkdir -p fonts sprites
for f in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do cp -r "$TMP/basemaps-assets-main/fonts/$f" fonts/; done
cp "$TMP/basemaps-assets-main/fonts/OFL.txt" fonts/
cp "$TMP"/basemaps-assets-main/sprites/v4/{light,dark}* sprites/
rm -rf "$TMP"
echo "carte prête dans $DIR : $(du -sh france.pmtiles | cut -f1), construction $BUILD"
