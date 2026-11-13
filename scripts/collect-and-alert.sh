#!/usr/bin/env bash
# Collecte quotidienne de Winnza sur le serveur (lancée par cron), avec alerte par mail au CHANGEMENT
# d'état : un mail quand la collecte échoue, un mail quand elle repasse. Pas de déluge si un échec dure.
#
# Le mail part par SMTP Gmail authentifié, avec les identifiants de la sonde externe déjà en place sur
# le serveur (/etc/isno-sonde.env : GMAIL_USER, GMAIL_APP_PASSWORD, ALERT_TO). Aucun secret ici.
# Tant qu'une collecte échoue, le site garde ses dernières données valides (une collecte en échec
# n'écrit rien : voir server/src/runner.ts).
#
# WINNZA_COLLECT_CMD remplace la commande de collecte (essais : « false » simule un échec).
set -u
cd "$(dirname "$0")/.."
STATE_DIR=/var/lib/winnza
STATE="$STATE_DIR/collect.state"
LOG=/var/log/winnza-collect.log
MAIL_CONF=/etc/isno-sonde.env
mkdir -p "$STATE_DIR"

out=$(${WINNZA_COLLECT_CMD:-docker compose run --rm collect} 2>&1)
rc=$?
{ echo "=== $(date -u +%FT%TZ) code=$rc"; printf '%s\n' "$out"; } >> "$LOG"

cur=ok; [ "$rc" -eq 0 ] || cur=fail
prev=$(cat "$STATE" 2>/dev/null || echo ok)
printf '%s' "$cur" > "$STATE"

# une valeur par clé, lue telle quelle (un mot de passe d'application Google contient des espaces)
conf() { sed -n "s/^$1=//p" "$MAIL_CONF" | head -1; }
send() { # $1 sujet  $2 corps
  local user pass to
  user=$(conf GMAIL_USER); pass=$(conf GMAIL_APP_PASSWORD); to=$(conf ALERT_TO)
  [ -n "$user" ] && [ -n "$pass" ] && [ -n "$to" ] || { logger -t winnza-collect "alerte impossible : $MAIL_CONF incomplet"; return 1; }
  printf 'From: Winnza <%s>\nTo: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n%s\n' "$user" "$to" "$1" "$2" \
    | curl -s --ssl-reqd --url smtps://smtp.gmail.com:465 \
        --user "$user:$pass" --mail-from "$user" --mail-rcpt "$to" --upload-file -
}

ctx="Serveur : $(hostname), $(date -u +%FT%TZ). Journal : $LOG"
if [ "$cur" = fail ] && [ "$prev" = ok ]; then
  send "[winnza] ECHEC de la collecte" "La collecte quotidienne de Winnza a échoué (code $rc). Le site garde ses dernières données valides.

$ctx

Fin de la sortie :
$(printf '%s\n' "$out" | tail -25)"
elif [ "$cur" = ok ] && [ "$prev" = fail ]; then
  send "[winnza] RETABLI : la collecte repasse" "La collecte de Winnza fonctionne de nouveau.

$ctx

$(printf '%s\n' "$out" | head -3)"
fi
logger -t winnza-collect "etat=$cur code=$rc"
exit "$rc"
