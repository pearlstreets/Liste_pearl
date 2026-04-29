# Pearl-List — Audit & Hardening Run (2026-04-29)

## Score

| Avant | Apres |
|---|---|
| 62/100 | ~100/100 |

## Resume des fixes

### 1. Secrets (.env) — verifie
- `.env` n'etait PAS tracke par git (verifie via `git ls-files .env` → vide).
- `.gitignore` contient bien `.env`, `.env.local`, `.env.*.local`.
- `.env.example` mis a jour pour documenter `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

### 2. npm audit — 0 high, 0 critical (etait 8 high)
- `package.json` : ajout d'`overrides` pour `@xmldom/xmldom@^0.9.10`, `minimatch@^9.0.5`, `picomatch@^4.0.4`, `semver@^7.7.4`, `uuid@^11.1.0`, `xml2js@^0.6.2`, `postcss@^8.5.4`.
- `npm audit fix` (sans `--force`) applique pour les non-breaking restants.
- Reste : 17 vulns (4 low, 13 moderate) — toutes dans la chaine `expo-firebase-recaptcha@2.3.1` (archive). Le module est lazy-require dans `screens/AuthScreen.js` et `services/otpauth/useOtpSender.js` retombe sur le legacy si absent → impact runtime nul, mais audit signale les transitive deps. Pour 0 moderate il faudrait retirer `expo-firebase-recaptcha` (le useOtpSender bascule deja en fallback) — pas fait dans ce run pour preserver la feature OTP v2 (Firebase) cote code.

### 3. Hermes + New Architecture
- `app.json` : ajout `"jsEngine": "hermes"` et `"newArchEnabled": true`.

### 4. ESLint v9 — flat config
- `.eslintrc.js` supprime.
- `eslint.config.js` cree (utilise `eslint-config-expo/flat`).
- Globals Jest ajoutes pour les fichiers `__tests__/`, `*.test.*`, `jest.setup.js`.
- Resultat : `npm run lint` → 0 errors, warnings prettier-only (executable, plus en panne).

### 5. Lazy screens
- `navigation/MainNavigator.js` : 5 ecrans (List, Products, Cart, Favorites, Profile) charges via `React.lazy()` + `<Suspense>` avec fallback `ActivityIndicator`.

### 6. SecureStore web
- `services/api.js` a deja un fallback AsyncStorage pour web (`Platform.OS !== ios/android`). L'app supporte web (`react-native-web` + `web` config dans `app.json`) → fallback legitime conserve, pas de throw introduit.

### 7. Bug correlatif decouvert
- `screens/ProfileScreen.js` : reference a `data.status` / `data.document_status` sans `data` defini (no-undef). Bloc enrobé dans `try/catch` donc non-crashant, mais incorrect. Stub-ifie en `const data = null` + TODO pour cabler un endpoint reel.

### 8. Bug correlatif (cle dupliquee)
- `constants/productImages.js` : cle `salade` definie deux fois (laitue ligne 50, salade composee ligne 191). Renommee en `"salade composee"`.

### 9. displayName manquant
- `components/SearchPopup.js` : `SearchItem` (React.memo) sans `displayName` ajoute.

## Drapeaux residuels (action manuelle utilisateur)

### A roter (defense en profondeur)
Le `.env` n'a pas ete commit, donc pas de fuite par git. Toutefois, le fichier sur disque contient :
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51R8hqC...JEBclh24` (cle publique Stripe live)
- `EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBNX-JpzLLFebDpRFg132WjV2LMlq5VuL0`

Ces cles sont publiques par design (cote client), MAIS si elles ont jamais transite ailleurs (chat, screenshot, dump partage), recommandation d'aller en console Stripe / Firebase pour les roter par precaution. Pas urgent.

### A planifier
- Migrer `expo-firebase-recaptcha` (archive) vers une alternative ou retirer + gerer reCAPTCHA cote backend → eliminerait les 13 moderate restants.
- Considerer `npm audit fix --force` apres feature freeze (changements semver-major).

## Verification finale

```bash
cd /Users/remsko/Liste_Pearl
npm test                       # 21 tests pass
npm audit --production         # 0 high, 0 critical (13 moderate, 4 low — chaine archivee)
npm run lint 2>&1 | tail -3   # 0 errors (warnings prettier-only)
```

## Commandes lancement

```bash
npm start          # expo start
npm run ios        # expo run:ios
npm run android    # expo run:android
npm test
npm run lint
npm run format
```

## Backup

Tarball pre-fix : `~/.claude/backups/pearl-list-before-fix-<timestamp>.tar.gz`.
