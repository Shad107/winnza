# Envoi d'une alerte par mail, partagé par la collecte et le déploiement. SMTP Gmail authentifié, avec les
# identifiants de la sonde externe déjà en place sur le serveur (/etc/isno-sonde.env : GMAIL_USER,
# GMAIL_APP_PASSWORD, ALERT_TO). Aucun secret ici. À inclure par « . scripts/lib-alert.sh ».
MAIL_CONF=/etc/isno-sonde.env
# une valeur par clé, lue telle quelle (un mot de passe d'application Google contient des espaces) ; sudo :
# le fichier n'est lisible que par root, et le déploiement tourne sous ubuntu
alert_conf() { sudo sed -n "s/^$1=//p" "$MAIL_CONF" | head -1; }
alert_send() { # $1 sujet  $2 corps
  local user pass to
  user=$(alert_conf GMAIL_USER); pass=$(alert_conf GMAIL_APP_PASSWORD); to=$(alert_conf ALERT_TO)
  [ -n "$user" ] && [ -n "$pass" ] && [ -n "$to" ] || { logger -t winnza "alerte impossible : $MAIL_CONF incomplet"; return 1; }
  printf 'From: Winnza <%s>\nTo: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n%s\n' "$user" "$to" "$1" "$2" \
    | curl -s --ssl-reqd --url smtps://smtp.gmail.com:465 \
        --user "$user:$pass" --mail-from "$user" --mail-rcpt "$to" --upload-file -
}
