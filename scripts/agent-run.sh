#!/usr/bin/env bash
# Un passage de l'IA qui gère le site, sous l'utilisateur winnza-agent. Lancé par scripts/agent-cron.sh (root),
# qui lui donne des COPIES qui ne lui appartiennent pas (déclaration, consignes, ce script) : l'agent ne peut pas
# modifier ce qui le borne. Écrit dans $OUT : le journal du moteur, son dernier message, et usage.json.
#   agent-run.sh <declaration agent.json> <consignes.md> <tendances.json> <dossier de sortie>
set -u
CONF=$1 PROMPT=$2 TRENDS=$3 OUT=$4
REPO="$HOME/winnza"
cd "$REPO" || exit 2
# sa copie suit main : un travail non poussé la veille est abandonné, jamais repris en douce
git fetch -q origin main && git checkout -q main && git reset -q --hard origin/main && git clean -qfd

read -r ENGINE MODEL BINARY AGENT_PATH < <(python3 - "$CONF" <<'PY'
import json, sys
c = json.load(open(sys.argv[1])); e = c["engines"][c["engine"]]
print(c["engine"], c["model"], e["binary"], ":".join(e["path"]))
PY
)
export PATH="$(printf '%s' "$AGENT_PATH" | sed "s#\([^:]*\)#$HOME/\1#g"):$PATH"
TEXT="$(cat "$PROMPT")

Fichier des tendances du jour : $TRENDS"
rm -f "$OUT/last.md" "$OUT/run.jsonl" "$OUT/usage.json"

case "$ENGINE" in
  codex)
    "$HOME/$BINARY" exec -m "$MODEL" -C "$REPO" --dangerously-bypass-approvals-and-sandbox --json -o "$OUT/last.md" "$TEXT" > "$OUT/run.jsonl" 2> "$OUT/run.err"
    rc=$?
    # somme des tours : jetons lus (dont depuis le cache) et écrits
    python3 - "$OUT/run.jsonl" > "$OUT/usage.json" <<'PY'
import json, sys
t = {"input": 0, "cachedInput": 0, "output": 0}
for line in open(sys.argv[1]):
    try: e = json.loads(line)
    except ValueError: continue
    if e.get("type") == "turn.completed":
        u = e.get("usage", {}); t["input"] += u.get("input_tokens", 0); t["cachedInput"] += u.get("cached_input_tokens", 0); t["output"] += u.get("output_tokens", 0)
print(json.dumps(t))
PY
    ;;
  claude)
    "$HOME/$BINARY" -p "$TEXT" --model "$MODEL" --dangerously-skip-permissions --output-format json > "$OUT/run.jsonl" 2> "$OUT/run.err"
    rc=$?
    python3 - "$OUT/run.jsonl" "$OUT/last.md" > "$OUT/usage.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); u = d.get("usage", {})
open(sys.argv[2], "w").write(d.get("result", ""))
cached = u.get("cache_read_input_tokens", 0)
print(json.dumps({"input": u.get("input_tokens", 0) + cached + u.get("cache_creation_input_tokens", 0), "cachedInput": cached, "output": u.get("output_tokens", 0)}))
PY
    ;;
  *) echo "moteur inconnu : $ENGINE" >&2; exit 2 ;;
esac
exit "$rc"
