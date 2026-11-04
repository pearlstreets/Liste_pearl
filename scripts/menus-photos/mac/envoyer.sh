#!/usr/bin/env bash
# Envoie les photos faites vers le serveur (rsync via l'alias ssh pearl-prod), puis du serveur vers S3
# (s3_envoi.py, identifiants du .env Django jamais affichés). Rien n'est jamais écrasé en ligne.
# Lancé à la main ou tout seul par generer_mac.py --envoyer-tous 500. Peut tourner pendant la génération.
#   bash scripts/menus-photos/mac/envoyer.sh [--a-blanc]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
RACINE="${PEARL_PHOTOS:-$HOME/pearl-photos}"
VERSION="${PHOTOS_VERSION:-1}"
DISTANT="list-menus-photos/v$VERSION"          # relatif au HOME du serveur
ENV_DJANGO='~/Marketplace---Pearl-Streets/Backend/Marketplace/.env'
A_BLANC=""; [ "${1:-}" = "--a-blanc" ] && A_BLANC="--a-blanc"

# Un seul envoi à la fois
VERROU="$RACINE/.envoi.lock"
mkdir "$VERROU" 2>/dev/null || { echo "Un envoi est déjà en cours ($VERROU)."; exit 0; }
trap 'rmdir "$VERROU"' EXIT

echo "== $(date '+%F %T') envoi v$VERSION"
# 1. Contrôle : doublons, quasi doublons, tailles (sharp si présent, sinon empreintes de etat.json)
EXIST=""; (cd "$DEPOT" && node -e "require('sharp')" 2>/dev/null) && EXIST="--existantes"
node "$DEPOT/scripts/menus-photos/controle.js" "$RACINE" $EXIST

# 2. Ce qui est déjà en ligne (tenu par le serveur), puis liste à refaire : jamais envoyée
ssh pearl-prod "cat ~/$DISTANT/en-ligne.txt 2>/dev/null || true" > "$RACINE/en-ligne.txt"
"$RACINE/venv/bin/python" "$ICI/generer_mac.py" --preparer-refaire

# 3. Copie vers le serveur (les .part en cours d'écriture sont ignorés)
ssh pearl-prod "mkdir -p ~/$DISTANT/images"
rsync -a --exclude '*.part' --exclude '.*' "$RACINE/images/" "pearl-prod:$DISTANT/images/"
rsync -a "$RACINE/refaire-liste.json" "$ICI/s3_envoi.py" "pearl-prod:$DISTANT/"

# 4. Sur le serveur : un Python qui a boto3 (venv Django d'abord), puis envoi S3 sans écrasement
ssh pearl-prod "bash -s" <<DISTANT_EOF
set -e
PY=""
for p in ~/Marketplace---Pearl-Streets/Backend/Marketplace/venv/bin/python ~/Marketplace---Pearl-Streets/Backend/venv/bin/python ~/Marketplace---Pearl-Streets/venv/bin/python python3; do
  if [ -x "\$p" ] || command -v "\$p" >/dev/null 2>&1; then
    if "\$p" -c 'import boto3' 2>/dev/null; then PY="\$p"; break; fi
  fi
done
[ -n "\$PY" ] || { echo "ERREUR : aucun Python avec boto3 sur le serveur" >&2; exit 1; }
nice -n 10 "\$PY" ~/$DISTANT/s3_envoi.py --dossier ~/$DISTANT --version $VERSION \
  --exclure ~/$DISTANT/refaire-liste.json --env $ENV_DJANGO $A_BLANC
DISTANT_EOF

# 5. État en ligne rapatrié (sert au refaire et au manifeste)
ssh pearl-prod "cat ~/$DISTANT/en-ligne.txt 2>/dev/null || true" > "$RACINE/en-ligne.txt"
echo "En ligne : $(wc -l < "$RACINE/en-ligne.txt" | tr -d ' ') images (https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v$VERSION/<id>.webp)"
