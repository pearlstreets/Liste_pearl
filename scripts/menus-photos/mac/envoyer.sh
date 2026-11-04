#!/usr/bin/env bash
# Envoie les photos faites sur le Mac vers le serveur, puis du serveur vers S3, par le même chemin que le PC :
# ~/list-menus-photos/v1/ sur pearl-prod, puis ~/list-menus-photos/s3_envoi.py --manifeste (installé par le PC),
# qui n'écrase JAMAIS une image déjà en ligne et refait le manifeste lu par l'application.
# Lancé tout seul par generer_mac.py --envoyer-tous N, ou à la main :
#   bash scripts/menus-photos/mac/envoyer.sh
set -euo pipefail
RACINE="${PEARL_PHOTOS:-$HOME/pearl-photos}"
APP=/home/ubuntu/Backend-Marketplace-Python/Marketplace---Pearl-Streets/BackendPython/Marketplace
SSH="ssh -o BatchMode=yes -o ConnectTimeout=20 pearl-prod"

# Un seul envoi à la fois
VERROU="$RACINE/.envoi.lock"
mkdir "$VERROU" 2>/dev/null || { echo "Un envoi est déjà en cours ($VERROU)."; exit 0; }
trap 'rmdir "$VERROU"' EXIT

echo "== $(date '+%F %T') envoi"
$SSH 'test -f ~/list-menus-photos/s3_envoi.py && mkdir -p ~/list-menus-photos/v1/ingredients' ||
  { echo "ERREUR : ~/list-menus-photos/s3_envoi.py absent du serveur (installé par le PC)"; exit 1; }

# Copie sans écraser ce que le PC a déjà déposé (les .part en cours d'écriture sont ignorés)
[ -d "$RACINE/images/recettes" ] &&
  rsync -a --ignore-existing --include '*.webp' --exclude '*' "$RACINE/images/recettes/" "pearl-prod:list-menus-photos/v1/"
[ -d "$RACINE/images/ingredients" ] &&
  rsync -a --ignore-existing --include '*.webp' --exclude '*' "$RACINE/images/ingredients/" "pearl-prod:list-menus-photos/v1/ingredients/"

# Sur le serveur : envoi S3 sans écrasement, puis manifeste refait s'il a changé
$SSH "cd $APP && nice -n 10 venv/bin/python ~/list-menus-photos/s3_envoi.py --manifeste 2>&1 | grep -E '^(REFUS|NOUVEAUX|MANIFESTE|Traceback|[A-Za-z]*Error)'" || true
echo "== $(date '+%F %T') fin de l'envoi"
