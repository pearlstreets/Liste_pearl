# Liste_Pearl — Règles git strictes pour Claude

## Avant TOUTE modification de fichier

1. `git status -sb` — obligatoire en début de session
2. Pour chaque fichier que tu prévois d'éditer, vérifier s'il apparaît dans le status :
   - `M <fichier>` → modifs préexistantes uncommitted (PAS de toi) sont sur disk
   - `D <fichier>` → suppression préexistante en cours
   - `??` → untracked

## Règle absolue — fichiers avec modifs préexistantes

**Si un fichier est `M` ou `D` dans `git status` au moment où tu arrives, tu n'as PAS le droit de le `git add <fichier>` directement après ton Edit.**

Tu vas embarquer dans ton commit des changements que tu n'as pas faits.

### Procédure surgicale obligatoire

```bash
# 1. Sauvegarder l'état mixed actuel (préexistant + ce que tu vas ajouter)
cp <fichier> /tmp/<fichier>.mixed

# 2. Restaurer le fichier à HEAD (efface le préexistant ET tes modifs)
git checkout HEAD -- <fichier>

# 3. Ré-appliquer SEULEMENT tes modifs sur la version HEAD restaurée

# 4. Stager + commit ta feature isolée
git add <fichier>
git commit -m "..."

# 5. Restaurer le mixed (réintroduit le préexistant en working dir)
cp /tmp/<fichier>.mixed <fichier>

# Le préexistant reste uncommitted — l'utilisateur décide
```

## Avant CHAQUE commit

```bash
git diff --staged --stat
```

Si l'output dépasse ce que tu as réellement écrit (genre `5000 deletions` pour 5 lignes ajoutées) → **STOP**. Tu as embarqué du préexistant. Reset (`git reset HEAD <fichier>`) et applique la procédure surgicale ci-dessus.

## `git add` interdits

- `git add .`
- `git add -A`
- `git add <dir>/`

Toujours énumérer chaque fichier explicitement par son chemin.

## Référence

Incident 2026-04-19 : `git add App.js` sur Liste_Pearl a embarqué un refactor préexistant de 5014 lignes dans un commit "feat(notifications)". Split corrigé en 2 commits (`99e8b1f`). Cette procédure existe pour empêcher la récurrence.
