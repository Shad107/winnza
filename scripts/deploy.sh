#!/usr/bin/env bash
# Déploiement de Winnza sur le serveur. Lancé par scripts/deploy-when-green.sh quand l'intégration continue
# de GitHub a validé un commit de main, ou à la main : ./scripts/deploy.sh [commit]
#
#   1. avance jusqu'au commit demandé, ou à main (avance rapide seulement : jamais d'écrasement silencieux)
#   2. garde l'image en service sous le nom winnza:previous
#   3. construit la nouvelle image (les tests du serveur tournent dans la construction)
#   4. redémarre le site et vérifie qu'il répond sur les pages qui comptent
#   5. sinon : remet l'image précédente, et sort en erreur (deploy-when-green.sh prévient Olivier)
set -euo pipefail
cd "$(dirname "$0")/.."
SITE="${WINNZA_SITE:-https://www.winnza.eu}"
# pages vérifiées après chaque déploiement : une par grande famille (l'accueil, une page du socle carburants,
# une page plugin, une page de ville engendrée)
CHECK_PATHS=(/ /taxes /electricite /cout-aux-100-km /prix-carburant/rennes-35 /sitemap.xml)
LOG=/var/log/winnza-deploy.log
log() { echo "$(date -u +%FT%TZ) $*" | sudo tee -a "$LOG" >&2; }

healthy() {
  for p in "${CHECK_PATHS[@]}"; do
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE$p" || echo 000)
    if [ "$code" != 200 ]; then log "vérification : $p répond $code"; return 1; fi
  done
}

before=$(git rev-parse HEAD)
git fetch -q origin main
git merge -q --ff-only "${1:-origin/main}"
after=$(git rev-parse HEAD)
log "déploiement ${before:0:7} -> ${after:0:7}"

had_previous=0
if sudo docker image inspect winnza:latest >/dev/null 2>&1; then
  sudo docker tag winnza:latest winnza:previous
  had_previous=1
fi

if ! sudo docker compose build web >/tmp/winnza-build.log 2>&1; then
  log "construction en échec, rien n'a changé en ligne (journal : /tmp/winnza-build.log)"
  tail -30 /tmp/winnza-build.log >&2
  exit 1
fi
sudo docker compose up -d web >/dev/null 2>&1

# le site met quelques secondes à recharger la base : on lui laisse jusqu'à une minute
for _ in $(seq 1 12); do
  if healthy; then log "en ligne : ${after:0:7}"; exit 0; fi
  sleep 5
done

log "le site ne répond pas correctement après ${after:0:7}"
if [ "$had_previous" = 1 ]; then
  sudo docker tag winnza:previous winnza:latest
  sudo docker compose up -d web >/dev/null 2>&1
  log "image précédente remise en service (code ${before:0:7})"
fi
exit 1
