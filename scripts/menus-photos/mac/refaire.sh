#!/usr/bin/env bash
# Refait les images signalées par controle.js (doublons, quasi doublons, tailles) avec une autre seed et
# une autre variation de prompt. Une image déjà EN LIGNE n'est jamais remplacée (v1 immuable) : on refait
# l'autre image de la paire. Jusqu'à 3 passes, tant qu'il reste des images à refaire.
#   bash scripts/menus-photos/mac/refaire.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
RACINE="${PEARL_PHOTOS:-$HOME/pearl-photos}"
PY="$RACINE/venv/bin/python"
VERSION="${PHOTOS_VERSION:-1}"

for passe in 1 2 3; do
  echo "== Passe $passe"
  EXIST=""; (cd "$DEPOT" && node -e "require('sharp')" 2>/dev/null) && EXIST="--existantes"
  node "$DEPOT/scripts/menus-photos/controle.js" "$RACINE" $EXIST
  if ssh -o BatchMode=yes -o ConnectTimeout=10 pearl-prod true 2>/dev/null; then
    ssh pearl-prod "cat ~/list-menus-photos/v$VERSION/en-ligne.txt 2>/dev/null || true" > "$RACINE/en-ligne.txt"
  fi
  "$PY" "$ICI/generer_mac.py" --preparer-refaire
  N=$("$PY" -c "import json,sys; print(len(json.load(open(sys.argv[1]))['ids']))" "$RACINE/refaire-liste.json")
  [ "$N" -gt 0 ] || { echo "Rien à refaire."; exit 0; }
  bash "$ICI/prompts.sh" --refaire "$RACINE/refaire-liste.json"
  "$PY" "$ICI/generer_mac.py" --prompts "$RACINE/prompts-refaire.json" --refaire
done
echo "3 passes faites ; relancer controle.js pour voir ce qui reste."
