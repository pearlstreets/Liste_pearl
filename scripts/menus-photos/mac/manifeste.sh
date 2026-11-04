#!/usr/bin/env bash
# Produit lib/menus/photosManifest.js à partir de ce qui est EN LIGNE (en-ligne.txt du serveur),
# après vérification par HEAD sur CloudFront d'un échantillon d'images.
#   bash scripts/menus-photos/mac/manifeste.sh [--echantillon 40]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
RACINE="${PEARL_PHOTOS:-$HOME/pearl-photos}"
VERSION="${PHOTOS_VERSION:-1}"
CDN="https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v$VERSION"
ECH=40; [ "${1:-}" = "--echantillon" ] && ECH="${2:-40}"

# 1. Liste en ligne, tenue par le serveur
ssh pearl-prod "cat ~/list-menus-photos/v$VERSION/en-ligne.txt 2>/dev/null || true" > "$RACINE/en-ligne.txt"
TOTAL=$(grep -c . "$RACINE/en-ligne.txt" || true)
[ "$TOTAL" -gt 0 ] || { echo "Rien en ligne." >&2; exit 1; }

# 2. Échantillon vérifié sur CloudFront : 200 et image/webp, sinon arrêt
ECHEC=0
while read -r ligne; do
  case "$ligne" in
    recettes/*) url="$CDN/${ligne#recettes/}.webp" ;;
    ingredients/*) url="$CDN/ingredients/${ligne#ingredients/}.webp" ;;
    *) continue ;;
  esac
  ent=$(curl -sI -m 20 "$url" | tr -d '\r')
  code=$(printf '%s\n' "$ent" | awk 'NR==1 {print $2}')
  type=$(printf '%s\n' "$ent" | awk -F': ' 'tolower($1)=="content-type" {print $2}')
  if [ "$code" != "200" ] || [ "$type" != "image/webp" ]; then
    echo "KO $code $type $url"; ECHEC=$((ECHEC + 1))
  fi
done < <(awk 'BEGIN {srand()} {print rand() "\t" $0}' "$RACINE/en-ligne.txt" | sort | head -n "$ECH" | cut -f2-)
[ "$ECHEC" -eq 0 ] || { echo "$ECHEC images de l'échantillon absentes de CloudFront : manifeste NON produit." >&2; exit 1; }
echo "Échantillon de $ECH images : toutes servies par CloudFront."

# 3. Dossier miroir avec SEULEMENT les images en ligne (liens durs), puis manifeste.js
SRC="$RACINE/manifeste-src"
rm -rf "$SRC"; mkdir -p "$SRC/images/recettes" "$SRC/images/ingredients"
MANQUE=0
while read -r ligne; do
  [ -n "$ligne" ] || continue
  if [ -f "$RACINE/images/$ligne.webp" ]; then ln "$RACINE/images/$ligne.webp" "$SRC/images/$ligne.webp"
  else MANQUE=$((MANQUE + 1)); fi
done < "$RACINE/en-ligne.txt"
[ "$MANQUE" -eq 0 ] || echo "ATTENTION : $MANQUE images en ligne absentes du Mac (hors manifeste)."
node "$DEPOT/scripts/menus-photos/manifeste.js" "$SRC" "$RACINE/photosManifest.js" --version "$VERSION"
cp "$RACINE/photosManifest.js" "$DEPOT/lib/menus/photosManifest.js"
echo "Manifeste copié : lib/menus/photosManifest.js"
