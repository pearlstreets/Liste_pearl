# Photos des recettes générées gratuitement sur le Mac

Cette chaîne fait une photo pour chaque recette sans photo et pour chaque ingrédient, soit **12 028 images**.
Tout tourne **sur le Mac**, avec un modèle libre : **rien de payant, aucune clé, aucun appel à OpenAI**.
`generer.js` ne sert ici qu'**à blanc**, pour écrire les prompts.

- **Modèle** : FLUX.1-schnell de Black Forest Labs, sous licence **Apache 2.0** (usage commercial permis).
  On prend la version 4 bits déjà convertie `mflux-community/flux-1-schnell-mflux-q4` (9,6 Go).
  Elle n'est soumise à aucun accord sur Hugging Face et garde la licence Apache 2.0.
  Le dépôt officiel `black-forest-labs/FLUX.1-schnell` fait 58 Go et demande d'accepter des conditions.
- **Logiciel** : `mflux` 0.24.0 (licence MIT), qui fait tourner FLUX en MLX sur puce Apple.
  Il demande **Python 3.11 ou plus**.
- **Style** : les prompts de `prompts.js` reprennent celui des 344 photos de `assets/menus`.
  C'est une photo culinaire réaliste : assiette en céramique claire, fond beige, lumière du jour, vue de trois quarts, accessoires flous derrière.
- **Adaptation des prompts à FLUX** : `generer_mac.py` retire la phrase « Reference <id> », que FLUX pourrait écrire dans l'image.
  Il raccourcit aussi la liste « No text, no letters… », parce que schnell lit au plus 256 jetons.
  Les prompts font alors 188 mots en moyenne, 222 au plus.
- **Seed** : elle est tirée de l'identifiant, donc la même image ressort à chaque fois. Une image refaite prend une autre seed et une autre variation.

## Durée et place

| | Estimation |
|---|---|
| Par image (M4, 640x640, 4 étapes, 4 bits) | **30 à 60 s**, environ 45 s, plus 30 à 60 s pour charger le modèle au démarrage |
| Total (12 028 images + environ 5 % à refaire, soit environ 12 630) | **environ 6,5 jours** sans arrêt, entre 4,5 et 9 jours |
| Disque sur le Mac | modèle 9,6 Go + venv environ 3 à 4 Go + images environ 0,6 Go (45 Ko l'une) = **environ 14 Go** ; l'installation exige 40 Go libres |
| Mémoire | environ 10 Go pendant la génération ; 16 Go au minimum |
| Disque sur le serveur | environ 0,6 Go dans `~/list-menus-photos/v1/` |

Ces chiffres sont des estimations. Aucun banc d'essai publié ne mesure exactement ce réglage :
- la doc de mflux donne environ 97 s pour un Mac mini M4 de 16 Go en 1024x1024, 2 étapes, 8 bits ;
- en 640x640, on a 2,5 fois moins de pixels.

Le journal donne la vraie moyenne et la fin prévue dès les premières images.

La génération tourne en **priorité basse** (`nice`) et empêche la mise en veille (`caffeinate -i`).
Le build des sites, lancé par launchd toutes les 2 min, passe donc devant pour le processeur.
Les images partent toutes seules vers S3 par lots de 500 pendant la génération.
L'application a ainsi vite une couverture variée : d'abord les 130 recettes écrites à la main, puis les 317 ingrédients, puis les recettes générées, une famille après l'autre.

## Étapes (exécutées par Claude sur le Mac)

Dossier de travail : `~/pearl-photos/`, hors du dépôt.

1. **Installer** : `bash scripts/menus-photos/mac/installer.sh`.
   Le script vérifie qu'on est sur macOS avec une puce Apple, Python 3.11 ou plus, 40 Go libres et 16 Go de mémoire.
   Il crée le venv `~/pearl-photos/venv`, installe `mflux==0.24.0` et Pillow, télécharge le modèle dans `~/pearl-photos/modele/` et installe `sharp` sans toucher `package.json`.
   Il vérifie enfin l'accès `ssh pearl-prod`.
2. **Prompts** : `bash scripts/menus-photos/mac/prompts.sh`, qui écrit `~/pearl-photos/prompts.json` (12 028 prompts, à blanc).
3. **Essai** : `~/pearl-photos/venv/bin/python scripts/menus-photos/mac/generer_mac.py --echantillon 20`.
   Il fait 4 recettes écrites à la main, 3 ingrédients et 13 recettes générées de familles différentes.
   **Montrer les 20 images au user et attendre son accord.**
4. **Tout générer**, en arrière-plan, pour plusieurs jours :
   `nohup ~/pearl-photos/venv/bin/python scripts/menus-photos/mac/generer_mac.py --envoyer-tous 500 >> ~/pearl-photos/sortie.log 2>&1 &`
   - Suivi : `tail -n 5 ~/pearl-photos/journal.log`, qui donne la moyenne, la fin prévue et les erreurs.
   - Arrêt propre : `touch ~/pearl-photos/STOP`. Le script finit l'image en cours puis s'arrête.
   - Reprise : relancer la même commande après avoir effacé le fichier STOP. Les images déjà faites sont sautées.
5. **Contrôle et images à refaire** : `bash scripts/menus-photos/mac/refaire.sh`.
   Le script lance `controle.js` (doublons exacts, quasi doublons aHash/dHash, taille, 640x640, comparaison aux 344 photos livrées).
   Il refait les images signalées, en 3 passes au plus. **Une image déjà en ligne n'est jamais remplacée** (v1 ne change pas) : on refait plutôt l'autre image de la paire.
6. **Envoi** : `bash scripts/menus-photos/mac/envoyer.sh`. Il est lancé tout seul tous les 500, et une dernière fois à la main à la fin.
   - D'abord, il contrôle les images et laisse de côté celles à refaire.
   - Ensuite, il copie les images par `rsync` vers `pearl-prod:~/list-menus-photos/v1/`.
   - Enfin, il lance `s3_envoi.py` **sur le serveur**, qui envoie dans le compartiment `markerplacemobileapp`, sous `uploads/list-menus/v1/<id>.webp` et `.../ingredients/<clé>.webp`.
   - En-têtes : `image/webp` et `public, max-age=31536000, immutable`.
   - Une clé déjà présente n'est jamais écrasée : `head_object`, puis écriture conditionnelle.
   - Les identifiants AWS sont lus dans le `.env` Django du serveur et ne sont jamais affichés. `--a-blanc` liste ce qui partirait.
   - Adresse publique : `https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v1/<id>.webp`.
7. **Manifeste** : `bash scripts/menus-photos/mac/manifeste.sh`.
   - Il ne prend que ce qui est **en ligne** : la liste `en-ligne.txt` est tenue par le serveur.
   - Il vérifie par HEAD sur CloudFront 40 images tirées au hasard. Si une seule manque, il s'arrête.
   - Il écrit `lib/menus/photosManifest.js` avec `manifeste.js`.
   - Ensuite : commit sur la branche, puis PR.

## Consigne à coller dans Claude Code sur le Mac

> Dans /Users/remsko/Liste_Pearl (dépôt pearlstreets/Liste_pearl), fais `git fetch` puis passe sur la branche `claude/list-photos-mac`. Suis scripts/menus-photos/mac/README-MAC.md.
>
> 1. Installe avec installer.sh, puis fais les prompts avec prompts.sh.
> 2. Pas d'essai : lance tout de suite toute la génération en arrière-plan, en même temps que le PC :
>    `nohup ~/pearl-photos/venv/bin/python scripts/menus-photos/mac/generer_mac.py --avec-pc --envoyer-tous 20 >> ~/pearl-photos/sortie.log 2>&1 &`
>    Le Mac prend les ingrédients puis les recettes en partant de la fin, et saute tout ce que le PC a déjà mis en ligne.
>    Les photos partent en ligne toutes les 20 images avec envoyer.sh, sans jamais écraser une photo déjà en ligne.
> 3. Vérifie que les premières photos sont bien en ligne (ligne `MANIFESTE` dans ~/pearl-photos/envoi.log, puis une adresse https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v1/<id>.webp en 200), puis montre-m'en quelques-unes avec le temps moyen par image et la fin prévue.
> 4. Ne reste jamais bloqué à attendre plus de 270 s : regarde le journal (`tail -n 5 ~/pearl-photos/journal.log`) de temps en temps. Ne merge rien.
>
> Les images restent toujours gratuites : uniquement FLUX.1-schnell en local avec mflux, jamais OpenAI ni aucun service payant, aucune clé. Coupe le son.

Si le dépôt n'est pas à cet endroit, Claude le trouve avec `ls ~ /Users/remsko` et cherche un dossier dont `git remote -v` donne `Liste_pearl`.

## Fichiers

- `installer.sh` : vérifications, venv, mflux épinglé, modèle 4 bits, sharp.
- `prompts.sh` : `generer.js --a-blanc --tout` vers `~/pearl-photos/prompts.json`. Avec `--refaire <liste>`, il écrit `prompts-refaire.json`.
- `generer_mac.py` : génération, ordre, reprise, STOP, journal, estimation de la fin, `caffeinate`, `nice`.
  Il calcule les empreintes au format de `images.js`, dans `etat.json`.
  Avec `--preparer-refaire`, il écrit la liste à refaire en tenant compte de ce qui est en ligne. `--a-blanc` vérifie la liste sans le modèle.
- `refaire.sh` : `controle.js`, puis `--preparer-refaire`, puis `prompts.sh --refaire`, puis la génération avec `--refaire`.
- `envoyer.sh` : contrôle, puis `rsync` vers le serveur, puis `s3_envoi.py`, puis rapatriement de `en-ligne.txt`.
- `s3_envoi.py` : envoi S3 côté serveur, sans écrasement, avec reprise.
- `manifeste.sh` : HEAD sur CloudFront, puis `manifeste.js`, puis copie dans `lib/menus/photosManifest.js`.
