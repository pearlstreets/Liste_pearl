#!/bin/bash
# Build + soumission stores (iOS + Android) — lancer APRÈS `eas login` (ou EXPO_TOKEN).
set -e
cd "$(dirname "$0")"
eas whoami >/dev/null 2>&1 || { echo "❌ Connecte-toi d'abord : eas login   (ou: export EXPO_TOKEN=ton_token)"; exit 1; }
echo "✅ EAS: $(eas whoami)"
echo "→ Build production iOS + Android (+ soumission auto aux stores)…"
eas build --platform all --profile production --auto-submit
echo "✅ Terminé. Suivi: https://expo.dev/accounts (builds + submissions)."
