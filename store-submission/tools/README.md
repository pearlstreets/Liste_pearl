# Générateurs de visuels marketing App Store

Composent les captures d'écran App Store (1242×2688) : écran de l'app dans un
mockup iPhone, sur fond de marque, avec gros titre + sous-titre.

- `gen_marketing_pearl_list.py`  — Pearl List (fond vert Pearl Streets)
- `gen_marketing_pearl_delivery.py` — Pearl Delivery / livreur (fond noir + accents verts)

## Usage
1. Capturer les écrans de l'app (simulateur) et les redimensionner :
   `xcrun simctl io <DEVICE> screenshot out.png && sips -z 2688 1242 out.png`
2. Adapter les chemins `SHOTS` / la liste `SCREENS` (fichier, titre, sous-titre) dans le script.
3. Générer les HTML : `python3 gen_marketing_pearl_list.py`
4. Rendre en PNG (Chrome headless) :
   ```
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
     --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
     --window-size=1242,2688 --screenshot=out.png "file:///chemin/mkt_1.html"
   ```
Tailles App Store acceptées : 1242×2688, 2688×1242, 1284×2778, 2778×1284.
