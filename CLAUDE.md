# Liste_Pearl — `pearl-list` (Expo + React Native)

App mobile compagnon « liste de courses / shopping list » de l'écosystème Pearl Streets.
Projets frères (même utilisateur, mêmes conventions i18n/sécurité/git) :
- `/Users/remsko/Pearl Streets Marketplace 1.0/` — monorepo principal (6 apps)
- `/Users/remsko/Livraison_pearl/` — app chauffeur-livreur `pearl-delivery`

## Principe directeur (toute action)

Fais en sorte que ce soit logique, simple, complet, fonctionnel, rapide et optimisé, afin d'éviter tout crash et de ne perdre aucune information importante.

**Plafond d'exploration : max 2 tool calls avant d'agir.** Table « Où chercher » ci-dessous → `Read` fichier cible → `Edit`. Si le chemin est dans la table, pas de grep/find en plus. Si ambigu : 1 question, pas de recherche. Grep autorisé seulement pour chercher une chaîne précise dans le code, et toujours scopé à un sous-dossier.

## Commandes

```bash
npm start          # expo start
npm run ios        # expo run:ios
npm run android    # expo run:android
npm test           # jest
npm run lint       # eslint . --ext .js,.jsx,.ts,.tsx
npm run format     # prettier --write '**/*.{js,jsx,ts,tsx,json}'
```

## Où chercher (feature → chemin)

| Feature | Chemin |
|---|---|
| Entry app | `App.js`, `index.js` |
| Navigation (bottom tabs) | `navigation/MainNavigator.js` |
| Écran Auth (login/register) | `screens/AuthScreen.js` |
| Liste de courses (écran principal) | `screens/ListScreen.js` |
| Catalogue produits | `screens/ProductsScreen.js` |
| Panier | `screens/CartScreen.js` |
| Favoris | `screens/FavoritesScreen.js` |
| Profil | `screens/ProfileScreen.js` |
| Contexts (state global) | `context/CartContext.js`, `context/CurrencyContext.js` |
| Hooks (auth/cart/fav) | `hooks/useAuth.js`, `hooks/useCart.js`, `hooks/useFavorites.js` |
| Services API | `services/api.js` (axios), `services/config.js` |
| Auth backend | `services/auth.js`, `services/security.js` |
| Produits | `services/products.js` |
| Commandes | `services/orders.js` |
| Livraison | `services/delivery.js` |
| Favoris backend | `services/favorites.js` |
| Profil backend | `services/profile.js` |
| Shops / magasins | `services/shops.js` |
| Push notifications | `services/oneSignalInit.js` |
| Components UI | `components/` (CurrencyPicker, LanguagePicker, PillScan, QtyInput, Radio, RepeatButton, SearchPopup, Square, Toast) |
| Error boundary | `components/ErrorBoundary.js` |
| Sélection produits lib | `lib/SelectedProducts.js` |
| Utilitaires | `utils/distributionMode.js`, `utils/openCamera.js`, `utils/spellcheck.js` |
| Constantes | `constants/` (accounts, brand, currencies, languages, productImages, storageKeys) |
| Données seed (catalogues FR) | `data/catalog-fr.json`, `data/grocery-fr.json`, `data/search-map.json` |
| i18n config | `i18n.js` |
| Locales (13) | `locales/` (ar, de, en, es, fr, it, ja, nl, pt, ru, sv, th, zh) |
| Types TS | `types/index.ts` |
| Styles partagés | `styles/shared.js` |
| Tests | `components/__tests__/`, `services/__tests__/`, `jest.setup.js` |
| Build config | `app.json`, `eas.json`, `babel.config.js`, `tsconfig.json` |
| Assets | `assets/` |

## Conventions

- **Expo managed** (pas de native module custom sans plan) — `expo run:ios` et `expo run:android` pour builds natifs
- **Navigation** : `@react-navigation/native` + bottom-tabs (single navigator `MainNavigator.js`)
- **State** : React Context (pas Redux) — `CartContext`, `CurrencyContext`, hooks `useAuth`/`useCart`/`useFavorites`
- **API** : axios via `services/api.js`, auth token via `services/auth.js` + `services/security.js`
- **i18n** : 13 locales minuscules (ar, de, en, es, fr, it, ja, nl, pt, ru, sv, th, zh) — différent du monorepo Marketplace (13 locales mais nommage différent : cn/jp/sa/se/tl/us vs zh/ja/ar/sv/th/en)
- **Push** : OneSignal via `services/oneSignalInit.js`
- **Storage** : `@react-native-async-storage/async-storage` (clés dans `constants/storageKeys.js`)

## Git — RÈGLES STRICTES (garde-fou incident 2026-04-19)

### Avant TOUTE modification de fichier

1. `git status -sb` — obligatoire en début de session
2. Pour chaque fichier que tu prévois d'éditer, vérifier s'il apparaît dans le status :
   - `M <fichier>` → modifs préexistantes uncommitted (PAS de toi) sur disk
   - `D <fichier>` → suppression préexistante en cours
   - `??` → untracked

### Règle absolue — fichiers avec modifs préexistantes

**Si un fichier est `M` ou `D` dans `git status` au moment où tu arrives, tu n'as PAS le droit de le `git add <fichier>` directement après ton Edit.** Tu embarquerais dans ton commit des changements que tu n'as pas faits.

#### Procédure surgicale obligatoire

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

### Avant CHAQUE commit

```bash
git diff --staged --stat
```

Si l'output dépasse ce que tu as réellement écrit (ex : `5000 deletions` pour 5 lignes ajoutées) → **STOP**. Tu as embarqué du préexistant. `git reset HEAD <fichier>` et procédure surgicale ci-dessus.

### `git add` interdits

- `git add .`
- `git add -A`
- `git add <dir>/`

Toujours énumérer chaque fichier explicitement par son chemin.

### Référence incident

2026-04-19 : `git add App.js` a embarqué un refactor préexistant de 5014 lignes dans un commit "feat(notifications)". Split corrigé en 2 commits (`99e8b1f`). Cette procédure existe pour empêcher la récurrence.
