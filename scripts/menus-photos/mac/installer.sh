#!/usr/bin/env bash
# Installe la chaîne de photos GRATUITE sur le Mac : venv Python, mflux (FLUX.1-schnell en MLX), Pillow,
# modèle 4 bits pré-quantifié (Apache 2.0, ~9,6 Go), sharp pour controle.js. Aucune clé, rien de payant.
#   bash scripts/menus-photos/mac/installer.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
RACINE="${PEARL_PHOTOS:-$HOME/pearl-photos}"
VENV="$RACINE/venv"
MFLUX_VERSION="0.24.0"
MODELE_REPO="mflux-community/flux-1-schnell-mflux-q4"
MODELE_REV="df1dada0a0e25bb8df6e1f7e4664959bf9ab86ce"   # révision vérifiée le 04/11/2026
MODELE_DIR="$RACINE/modele/flux-1-schnell-mflux-q4"
DISQUE_MIN_GO=40
MEMOIRE_MIN_GO=16

echec() { echo "ÉCHEC : $*" >&2; exit 1; }

# 1. macOS sur puce Apple (y compris depuis un terminal Rosetta)
[ "$(uname -s)" = "Darwin" ] || echec "macOS requis"
[ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ] || echec "puce Apple (arm64) requise"
[ "$(uname -m)" = "arm64" ] || echec "terminal sous Rosetta (x86_64) : relancez dans un terminal arm64"
echo "macOS $(sw_vers -productVersion), $(sysctl -n machdep.cpu.brand_string)"

# 2. Espace disque (modèle 9,6 Go + venv ~4 Go + images ~0,6 Go, avec marge)
mkdir -p "$RACINE"
LIBRE_GO=$(df -g "$RACINE" | awk 'NR==2 {print $4}')
echo "Disque libre : ${LIBRE_GO} Go"
[ "$LIBRE_GO" -ge "$DISQUE_MIN_GO" ] || echec "moins de ${DISQUE_MIN_GO} Go libres (${LIBRE_GO} Go)"

# 3. Mémoire (le modèle 4 bits occupe ~10 Go pendant la génération)
MEM_GO=$(( $(sysctl -n hw.memsize) / 1073741824 ))
echo "Mémoire : ${MEM_GO} Go"
[ "$MEM_GO" -ge "$MEMOIRE_MIN_GO" ] || echec "moins de ${MEMOIRE_MIN_GO} Go de mémoire"
if [ "$MEM_GO" -lt 24 ]; then
  echo "ATTENTION : ${MEM_GO} Go de mémoire ; pendant un build des sites le Mac peut ralentir (swap)."
fi

# 4. Python 3.11 ou plus (mflux $MFLUX_VERSION l'exige)
PY=""
for c in python3.13 python3.12 python3.11 /opt/homebrew/bin/python3 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    PY="$(command -v "$c")"; break
  fi
done
if [ -z "$PY" ]; then
  command -v brew >/dev/null 2>&1 || echec "Python 3.11+ absent et Homebrew absent"
  echo "Python 3.11+ absent : brew install python@3.12"
  brew install python@3.12
  PY="$(brew --prefix)/bin/python3.12"
fi
echo "Python : $PY ($("$PY" -V))"

# 5. venv + mflux épinglé + Pillow
[ -x "$VENV/bin/python" ] || "$PY" -m venv "$VENV"
"$VENV/bin/python" -m pip install --quiet --upgrade pip
"$VENV/bin/python" -m pip install --quiet "mflux==$MFLUX_VERSION" "pillow>=13"
"$VENV/bin/python" - <<'PYEOF'
import mflux, PIL
from importlib.metadata import version
from PIL import features
from mflux.models.flux.variants.txt2img.flux import Flux1  # noqa: F401
from mflux.models.common.config import ModelConfig
assert ModelConfig.schnell().max_sequence_length == 256
assert features.check("webp"), "Pillow sans WebP"
print("mflux", version("mflux"), "Pillow", PIL.__version__, ": OK")
PYEOF

# 6. Modèle 4 bits pré-quantifié (non soumis à accord, Apache 2.0), téléchargé une seule fois
# (hf download reprend un téléchargement interrompu et saute les fichiers déjà complets)
echo "Modèle (~9,6 Go la première fois) : $MODELE_REPO@$MODELE_REV"
mkdir -p "$MODELE_DIR"
HF_HUB_DISABLE_TELEMETRY=1 "$VENV/bin/hf" download "$MODELE_REPO" --revision "$MODELE_REV" --local-dir "$MODELE_DIR"
du -sh "$MODELE_DIR"

# 7. Node : dépendances du dépôt (prompts) et sharp sans toucher package.json (controle.js, manifeste)
command -v node >/dev/null 2>&1 || echec "node absent"
if [ ! -d "$DEPOT/node_modules/@babel/core" ]; then
  (cd "$DEPOT" && npm ci --no-audit --no-fund)
fi
if ! (cd "$DEPOT" && node -e "require('sharp')" 2>/dev/null); then
  (cd "$DEPOT" && npm i --no-save --no-audit --no-fund sharp)
fi
if [ -n "$(cd "$DEPOT" && git status --porcelain package.json package-lock.json)" ]; then
  echec "package.json ou package-lock.json modifié : à remettre (git checkout -- package.json package-lock.json)"
fi

# 8. Accès au serveur (pour envoyer.sh)
if ssh -o BatchMode=yes -o ConnectTimeout=10 pearl-prod true 2>/dev/null; then
  echo "ssh pearl-prod : OK"
else
  echo "ATTENTION : ssh pearl-prod injoignable ; la génération marche, l'envoi attendra."
fi
echo "Installation terminée. Suite : bash $ICI/prompts.sh"
