#!/usr/bin/env bash
# Chaque jour (crontab de root), après la collecte du matin : l'IA qui gère le site fait son passage.
#   1. budget : la dépense du mois (tenue par root, dans un fichier que l'agent ne peut pas toucher) doit
#      rester sous monthlyBudgetUsd de declarations/agent.json, sinon pas de passage ;
#   2. tendances du jour, extraites de la base et déposées pour l'agent seul ;
#   3. passage, sous l'utilisateur winnza-agent, avec des copies de la déclaration, des consignes et du
#      script qui appartiennent à root (version DÉPLOYÉE du dépôt) ;
#   4. dépense réelle comptée au tarif déclaré, et compte rendu envoyé par mail à Olivier.
set -u
cd "$(dirname "$0")/.."
. scripts/lib-alert.sh
AGENT=winnza-agent
LIB=/usr/local/lib/winnza-agent        # copies figées, à root
WORK=/var/lib/winnza-agent             # au nom de l'agent : tendances et sorties du passage
SPEND=/var/lib/winnza/agent-spend.jsonl
LOG=/var/log/winnza-agent.log
mkdir -p "$LIB" /var/lib/winnza
install -d -o "$AGENT" -g "$AGENT" -m 700 "$WORK"
install -o root -g root -m 755 scripts/agent-run.sh "$LIB/agent-run.sh"
install -o root -g root -m 644 declarations/agent.json "$LIB/agent.json"
PROMPT_FILE=$(python3 -c 'import json; print(json.load(open("declarations/agent.json"))["promptFile"])')
install -o root -g root -m 644 "$PROMPT_FILE" "$LIB/prompt.md"

read -r MODEL BUDGET TIMEOUT < <(python3 -c 'import json; c=json.load(open("declarations/agent.json")); print(c["model"], c["monthlyBudgetUsd"], c["timeoutMinutes"])')
SPENT=$(python3 - "$SPEND" <<'PY'
import json, sys, datetime
month = datetime.date.today().isoformat()[:7]; total = 0.0
try:
    for line in open(sys.argv[1]):
        r = json.loads(line)
        if r["date"].startswith(month): total += r["costUsd"]
except FileNotFoundError: pass
print(f"{total:.4f}")
PY
)
if python3 -c "import sys; sys.exit(0 if float('$SPENT') >= float('$BUDGET') else 1)"; then
  echo "$(date -u +%FT%TZ) budget du mois atteint ($SPENT \$ sur $BUDGET \$) : pas de passage" >> "$LOG"
  exit 0
fi

docker compose run --rm -T collect node server/dist/cli.js trends /data/energy.db > "$WORK/tendances.json" 2>/dev/null
chown "$AGENT:$AGENT" "$WORK/tendances.json"; chmod 600 "$WORK/tendances.json"

started=$(date -u +%FT%TZ)
timeout "${TIMEOUT}m" sudo -u "$AGENT" -H bash "$LIB/agent-run.sh" "$LIB/agent.json" "$LIB/prompt.md" "$WORK/tendances.json" "$WORK"
rc=$?

# dépense réelle de ce passage, au tarif déclaré du modèle
COST=$(python3 - "$WORK/usage.json" "$LIB/agent.json" "$MODEL" <<'PY'
import json, sys
try: u = json.load(open(sys.argv[1]))
except (FileNotFoundError, ValueError): u = {"input": 0, "cachedInput": 0, "output": 0}
p = json.load(open(sys.argv[2]))["pricing"][sys.argv[3]]
cost = ((u["input"] - u["cachedInput"]) * p["input"] + u["cachedInput"] * p["cachedInput"] + u["output"] * p["output"]) / 1e6
print(json.dumps({"tokens": u, "costUsd": round(cost, 4)}))
PY
)
python3 - "$SPEND" "$started" "$MODEL" "$rc" "$COST" <<'PY'
import json, sys
r = json.loads(sys.argv[5]); r.update({"date": sys.argv[2], "model": sys.argv[3], "exitCode": int(sys.argv[4])})
open(sys.argv[1], "a").write(json.dumps(r) + "\n")
PY
echo "$started modèle $MODEL, code $rc, $COST" >> "$LOG"

report=$(cat "$WORK/last.md" 2>/dev/null || echo "(aucun compte rendu : voir $WORK/run.err)")
alert_send "[winnza] L'IA du site : compte rendu du $(date +%d/%m)" "$report

Passage : modèle $MODEL, code de sortie $rc, $COST.
Dépense du mois avant ce passage : $SPENT \$ sur $BUDGET \$.
Journal : $LOG ; sorties : $WORK"
