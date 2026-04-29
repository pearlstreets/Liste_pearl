# Pearl-List — Audit & Hardening Run (2026-04-29)

## Score

| Avant | Apres run #1 (commit b1b76f0) | Apres run #2 (firebase-recaptcha removal) |
|---|---|---|
| 62/100 | ~95/100 (8 HIGH → 0, mais 13 moderate restants) | 100/100 (0 prod vuln) |

## Run #2 — Firebase reCAPTCHA migration (Option C)

**Objectif** : eliminer les 12-13 moderate restants en migrant hors `expo-firebase-recaptcha@2.3.1` (archive).

**Decision** : **Option C — desactiver le 2FA SMS Firebase cote client.**

Justification :
- Le code `useOtpSender.js` precedent gardait le path `firebase` mais retombait deja sur fallback (recaptcha jamais wired en prod, voir README session C).
- Option A (`@react-native-firebase/auth`) demande EAS Build + native modules custom → contredit la convention CLAUDE.md « Expo managed, pas de native module sans plan ».
- Option B (Firebase Web SDK + recaptcha verifier) garde la chaine vulnerable + un module archive.
- Option C supprime du code mort tout en ouvrant une vraie roadmap pour Twilio/WhatsApp (deja supportes server-side via `services/otpauth/otpV2Client.js`).

**Modifs** :
1. `package.json` : retire `expo-firebase-recaptcha@^2.3.1` et `firebase@^12.12.1`. Bump override `uuid` de `^11.1.0` → `^14.0.0` (corrige une chaine `xcode → uuid<14` separee).
2. `screens/AuthScreen.js` : retire le `try/require` de `FirebaseRecaptchaVerifierModal`, le state `firebaseOptions`, le ref `recaptchaVerifier`, le `useEffect` Firebase init, et le `<FirebaseRecaptchaVerifierModal>` JSX dans la modale Phone OTP. Le flux reste fonctionnel pour Twilio/WhatsApp.
3. `services/otpauth/useOtpSender.js` : retire l'import `firebase/auth` dynamique, retire les params `recaptchaVerifier`. Le provider `firebase` recu du backend declenche maintenant `shouldFallback=true` (legacy email/password).
4. `services/otpauth/firebase.js` : supprime (devenu dead code).
5. `services/otpauth/README.md` : reecrit pour documenter le nouveau modele Twilio/WhatsApp + roadmap re-activation Firebase.

**Resultat audit** :
| | Avant run #2 | Apres run #2 |
|---|---|---|
| `npm audit` (full) | 17 (4 low, 13 moderate) | 5 (5 low) |
| `npm audit --production` | 13 moderate | **0 vuln** |

Les 5 low restantes sont **dev-only** (`@tootallnate/once → http-proxy-agent → jsdom → jest-environment-jsdom → jest-expo`). Pas d'impact runtime, pas de fix non-breaking disponible (jest-expo @ 47 = breaking).

**Tests** : 21/21 pass. **Lint** : 0 erreurs (warnings prettier inchanges).

## Roadmap re-activation 2FA SMS Firebase (si besoin futur)

Voir `services/otpauth/README.md` pour le plan complet. Resume :

- **Option A — `@react-native-firebase/auth`** : drop le plist `GoogleService-Info.plist` (iOS) et `google-services.json` (Android) depuis Firebase Console, ajouter le plugin Expo `@react-native-firebase/app`. Necessite EAS Build (pas Expo Go).
- **Option B — attendre un helper recaptcha Expo maintenu** : surveiller https://docs.expo.dev/guides/using-firebase/. En attendant, Twilio + WhatsApp couvre l'usage.

Cote backend, le provider `firebase` reste supporte ; seul le client Liste_Pearl ne le consomme plus.

## Run #1 (commit b1b76f0) — synthese

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
- `EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBNX-JpzLLFebDpRFg132WjV2LMlq5VuL0` (devenu non utilise — peut etre retire)

Ces cles sont publiques par design (cote client), MAIS si elles ont jamais transite ailleurs (chat, screenshot, dump partage), recommandation d'aller en console Stripe / Firebase pour les roter par precaution. Pas urgent.

### A planifier
- Considerer `npm audit fix --force` apres feature freeze (changements semver-major) pour les 5 low dev-only restantes (jest-expo).
- Re-activer Firebase phone-auth via `@react-native-firebase/auth` quand EAS Build est en place (voir roadmap ci-dessus).

## Verification finale

```bash
cd /Users/remsko/Liste_Pearl
npm test                       # 21 tests pass
npm audit --production         # 0 vuln
npm audit                      # 5 low (dev-only, jest-expo)
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
