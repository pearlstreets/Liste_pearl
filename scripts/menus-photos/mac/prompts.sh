#!/usr/bin/env bash
# Produit ~/pearl-photos/prompts.json (12 028 prompts) avec generer.js À BLANC : aucun appel, aucune clé.
#   bash scripts/menus-photos/mac/prompts.sh                      tous les prompts
#   bash scripts/menus-photos/mac/prompts.sh --refaire <liste>    prompts décalés des images à refaire
#                                                                   écrit ~/pearl-photos/prompts-refaire.json
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
RACINE="${PEARL_PHOTOS:-$HOME/pearl-photos}"
mkdir -p "$RACINE"

if [ ! -d "$DEPOT/node_modules/@babel/core" ]; then
  echo "node_modules absent : npm ci dans $DEPOT" >&2
  (cd "$DEPOT" && npm ci --no-audit --no-fund)
fi

CIBLE="$RACINE/prompts.json"
EXTRA=()
if [ "${1:-}" = "--refaire" ]; then
  [ -f "${2:-}" ] || { echo "liste à refaire introuvable : ${2:-}" >&2; exit 1; }
  EXTRA=(--refaire "$2")
  CIBLE="$RACINE/prompts-refaire.json"
fi

# --a-blanc : generer.js n'appelle jamais l'API ; la clé OpenAI est retirée de l'environnement par sûreté.
env -u OPENAI_API_KEY node "$DEPOT/scripts/menus-photos/generer.js" "$RACINE" --a-blanc --tout "${EXTRA[@]}"
mv "$RACINE/prompts-a-blanc.json" "$CIBLE"
echo "Prompts : $CIBLE"
