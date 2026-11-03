# Photos IA des recettes et des ingrédients

Une photo unique pour chaque recette sans photo et pour chaque ingrédient, dans le style des 344 photos
livrées (`assets/menus`, 640x640) : photo culinaire réaliste, assiette en céramique claire, fond beige
clair, lumière naturelle douce, vue de trois quarts, accessoires flous derrière.

## Ce qui est à générer

| Lot | Images | Coût (0,011 $ l'image) |
|---|---|---|
| Recettes écrites à la main sans photo (`"image": false`) | 130 | 1,43 $ |
| Recettes générées du catalogue (`g-…`) | 11 581 | 127,39 $ |
| Ingrédients (`data/menus/ingredients.json`) | 317 | 3,49 $ |
| **Total** | **12 028** | **132,31 $** |

Prévoir environ 5 % d'images refaites après contrôle, soit environ 139 $ au total.
Modèle `gpt-image-1-mini`, 1024x1024, qualité `medium`, converti en WebP 640x640 qualité 80 (environ 45 Ko).

Durée : environ 20 s par image, 6 en parallèle, soit environ **11 h** pour tout, si les limites de débit du
compte le permettent. Sinon, le script attend ce que l'API demande (429, `Retry-After`) et reprend tout seul.

## Étapes

1. **À blanc** (aucun appel, aucune clé) : relire les prompts.
   `node scripts/menus-photos/generer.js --a-blanc --echantillon 20`
   puis `--tout` pour tout vérifier : nombre exact, prompts tous différents, longueur moyenne.
2. **Installer sharp** sans toucher `package.json` : `npm i --no-save sharp`.
   À défaut : `cwebp -q 80 -resize 640 640`.
3. **Échantillon payant** (environ 0,22 $), dossier **hors du dépôt** :
   `OPENAI_API_KEY=… node scripts/menus-photos/generer.js D:/photos-list --echantillon 20`
   Regarder les 20 images avant de continuer.
4. **Tout générer** : `… generer.js D:/photos-list --tout --budget 140`.
   Options : `--parallele 6`, `--ids a,b`, `--ingredients`.
   Reprise : une image déjà présente est sautée.
   Arrêt propre : Ctrl+C, ou créer le fichier `D:/photos-list/STOP`.
   État et coût cumulé : `etat.json`.
5. **Contrôle** : `node scripts/menus-photos/controle.js D:/photos-list --existantes`.
   Il vérifie que chaque fichier est non vide, entre 8 et 250 Ko et en 640x640.
   Il signale les doublons exacts et les quasi doublons : aHash et dHash 64 bits tous deux à une distance de Hamming ≤ 6 (`--regle ou` : un seul suffit).
   Il écrit `a-refaire.json`, que l'on passe ensuite à `generer.js D:/photos-list --refaire D:/photos-list/a-refaire.json`.
   L'ancienne image est rangée dans `rejetees/` et la nouvelle est faite avec une autre variation.
6. **Manifeste** : `node scripts/menus-photos/manifeste.js D:/photos-list D:/photos-list/photosManifest.js --version 1 --refus D:/photos-list/a-refaire.json`.
   Il contient un bitset en base 64 des recettes générées (1 931 caractères pour 11 581 cases, alphabet de `lib/menus/b64.js`).
   Il contient aussi la liste des recettes écrites à la main et la liste des ingrédients qui ont une photo, avec `PHOTOS_VERSION`.
   Ensuite, le copier dans `lib/menus` (le script refuse d'écrire dans `lib/`).

## Hébergement prévu

- Compartiment S3 `markerplacemobileapp`.
- Recettes : `uploads/list-menus/v1/<id>.webp`.
- Ingrédients : `uploads/list-menus/v1/ingredients/<clé>.webp`.
- En-têtes : `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`.
- **Jamais d'écrasement** : pour changer des photos, nouveau préfixe `v2`, `v3`…, puis nouveau manifeste avec `--version` correspondant.
  L'adresse change, donc le cache des téléphones est cassé.
- Envoi par exemple :
  `aws s3 sync D:/photos-list/images/recettes s3://markerplacemobileapp/uploads/list-menus/v1/ --size-only --content-type image/webp --cache-control "public, max-age=31536000, immutable"`.
  Ne jamais utiliser `--delete`.

## Fichiers

- `prompts.js` : prompt anglais de chaque recette et de chaque ingrédient.
  Il se fonde sur le titre anglais, les ingrédients principaux du cœur `lib/menus/catalog.js`, le type de plat et la cuisine.
  Le style est commun à tous. Chaque prompt porte son identifiant.
  Une variation déterministe par famille (angle, assiette, fond, lumière, accessoires) donne 7 200 combinaisons distinctes par famille.
- `generer.js` : liste de travail, reprise, parallélisme, respect du 429, budget, arrêt propre, `--a-blanc`.
- `controle.js` : contrôle des fichiers, doublons et quasi doublons, liste à refaire.
- `manifeste.js` : manifeste compact pour l'application.
- `donnees.js` : chargement des données. Le cœur du catalogue est lu via `@babel/core`.
- `images.js` : dimensions, conversion WebP, empreintes.
- Test : `npx jest __tests__/menus-photos-prompts.test.js`.
