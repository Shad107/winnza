#!/usr/bin/env bash
# Toutes les 5 minutes (crontab de l'utilisateur ubuntu) : si main a un nouveau commit et que l'intégration
# continue de GitHub l'a validé (contrôles « secrets », « test » et « web » tous réussis), on le déploie.
# Le serveur VIENT CHERCHER : aucune connexion entrante, le port SSH reste fermé à GitHub. Le dépôt est
# public, l'API se lit sans jeton (60 requêtes par heure ; ce script en fait au plus deux toutes les 5 minutes).
# Un commit déjà tenté n'est pas retenté : on attend le suivant (un correctif). Un déploiement en échec
# remet l'image précédente (scripts/deploy.sh) et prévient Olivier par mail.
set -u
cd "$(dirname "$0")/.."
. scripts/lib-alert.sh
REPO=Shad107/winnza
REQUIRED="secrets test web"
STATE_DIR=/var/lib/winnza
STATE=$STATE_DIR/deploy.state
sudo mkdir -p "$STATE_DIR"

api() { curl -fsS --max-time 30 -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$REPO/$1"; }

sha=$(api commits/main | python3 -c 'import sys, json; print(json.load(sys.stdin)["sha"])') || exit 0
[ "$sha" = "$(git rev-parse HEAD)" ] && exit 0
[ "$(sudo cat "$STATE" 2>/dev/null | cut -d" " -f1)" = "$sha" ] && exit 0

# vert : tous les contrôles requis terminés et réussis ; en attente : l'un n'est pas fini ; rouge sinon
verdict=$(api "commits/$sha/check-runs?per_page=100" | REQUIRED="$REQUIRED" python3 -c '
import json, os, sys
runs = {r["name"]: r for r in json.load(sys.stdin)["check_runs"]}
need = os.environ["REQUIRED"].split()
if any(n not in runs or runs[n]["status"] != "completed" for n in need): print("attente")
elif all(runs[n]["conclusion"] == "success" for n in need): print("vert")
else: print("rouge " + " ".join(n for n in need if runs[n]["conclusion"] != "success"))') || exit 0

case "$verdict" in
  attente) exit 0 ;;
  rouge*) echo "$sha refuse ${verdict#rouge }" | sudo tee "$STATE" >/dev/null
          logger -t winnza "déploiement refusé : ${sha:0:7}, contrôles en échec : ${verdict#rouge }"; exit 0 ;;
esac

if out=$(./scripts/deploy.sh "$sha" 2>&1); then
  echo "$sha ok" | sudo tee "$STATE" >/dev/null
else
  echo "$sha echec" | sudo tee "$STATE" >/dev/null
  alert_send "[winnza] ECHEC du déploiement ${sha:0:7}" "Le commit ${sha:0:7} avait passé l'intégration continue, mais le site ne répondait pas correctement après son déploiement. L'image précédente a été remise en service.

Serveur : $(hostname), $(date -u +%FT%TZ). Journal : /var/log/winnza-deploy.log

$(printf '%s\n' "$out" | tail -25)"
fi
