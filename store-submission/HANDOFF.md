# Passation — Pearl List, sortie publique (session autonome du 13/07/2026)

> Ce que j'ai fait sans toi, et les **seules** étapes qu'il te reste. Rien n'est perdu : tout le code est commité sur `main`.

## ✅ FAIT en autonomie

### Code (commité sur `main`)
- **Paiement carte** de bout en bout (tunnel prouvé en prod : commande `OXNI1BQY7U` payée, reçue par le pro).
- **Retour auto 3DS** : `urlScheme` + `returnURL` → la page banque se referme seule (fini « fermer la fenêtre »).
- **Belle popup intégrée** (fini l'alerte iOS grise) pour créneau requis / échec commande / panier vide.
- **États vides épurés** : icône retirée + texte **centré** (Ma Liste, Produits, Boutiques, Panier, Profil).
- **Prod-readiness** : `icon` + `splash` déclarés dans `app.json`, `ACTIVE_ENV=production`, Stripe **pk_live**, 0 `console.log`.
- **Config Google Maps Android** ajoutée dans `app.json` (placeholder).
- Dépendance `react-native-maps` installée (build débloqué).

### App Store Connect (déjà rempli par moi, fiche `com.pearlstreets.list`, app id 6762128624)
- ✅ Sous-titre : « Votre liste, vos boutiques »
- ✅ Catégorie : Shopping
- ✅ Description, Mots-clés, Texte promotionnel (enregistrés)
- ✅ **Doublon résolu** : les 2 fiches App Store viennent de 2 bundles distincts (Expo credentials). La **bonne** = `com.pearlstreets.list` (celle que j'ai remplie). Le **doublon** = `com.localidad.liste-de-pearl` (ancien bundle abandonné) → à supprimer par toi (je ne supprime jamais).
- ✅ **App vérifiée à l'écran** (build Release, via simctl) : « Aucun article » centré, icône retirée, **zéro crash / écran blanc**.
- ✅ **Credentials de signature OK** : les builds Expo d'il y a 14-23h ont réussi → certificats iOS + keystore Android configurés et fonctionnels.

### Livrables prêts (dossier `store-submission/`)
- `privacy-policy.html` — à héberger (ex. `pearlstreets.com/pearl-list/privacy`)
- `store-listing.md` — tous les textes (iOS + Android)
- `SUBMISSION_CHECKLIST.md` — checklist détaillée

## 🚀 ÉTAT LIVE (session en cours)
- **`eas login` fait** (localidad) — session active sur la machine.
- **Build ANDROID : ✅ FINISHED** (AAB prêt) — build `23dda8b1-494e-4758-a77c-3045e2088346`.
- **Build iOS #1 : ❌ ERRORED** — cause = entitlement **Apple Pay** (`merchantIdentifier` du plugin Stripe) non supporté par le provisioning profile.
  - **CORRIGÉ** : retiré `merchantIdentifier` (on n'utilise pas Apple Pay), supprimé le `ios/PearlList.entitlements` tracké, gitignoré `ios/`+`android/` → prebuild EAS propre.
  - **Build iOS #2 relancé** : `9b7f5fd0-7fc3-48bb-9c1c-45c73b7846b1` (en cours).
- Credentials de signature iOS OK (cert + provisioning valides jusqu'à avril 2027).

### 🟡 SOUMISSION — état réel (testé)
- **iOS : clé API App Store Connect DÉJÀ stockée dans EAS** ✅ (`SQ845JY94A`) → **je peux soumettre tout seul**. 1ère tentative a échoué juste sur « build number 6 déjà utilisé » → corrigé (**build 10**), rebuild + auto-submit en cours. L'upload vers App Store Connect se fera automatiquement.
- **Android : BLOQUÉ** → `eas submit` échoue : *« Google Service Account Keys cannot be set up in --non-interactive mode »*. Il faut **ta clé de compte de service Google Play** (JSON). Options : la configurer puis `eas submit -p android --latest`, OU uploader l'AAB manuellement dans Play Console.

### iOS — après l'upload EAS (ce qu'il te restera dans App Store Connect)
Métadonnées texte = ✅ déjà remplies par moi. Restent : **captures d'écran**, **Confidentialité de l'app** (questionnaire), **Classification par âge**, attacher le build 10 à la version 1.0, puis **« Ajouter pour vérification »** (ton clic final).

**2 façons de finir la soumission :**
1. **Tu configures les clés** (une fois) : Play → compte de service JSON ; ASC → clé API `.p8`. Puis lance :
   ```bash
   eas submit -p android --latest    # te demandera le JSON Play
   eas submit -p ios --latest        # te demandera la clé API ASC
   ```
2. **Upload manuel** : AAB dans Play Console (track Production) ; `.ipa` via l'app **Transporter** (Mac) vers App Store Connect.

- ⚠️ **Carte Android** : Maps key en placeholder → carte livraison blanche sur Android (pas de crash). À corriger v1.1.

## 🟡 CE QU'IL TE RESTE (les seules choses que je ne peux pas faire)

### 1. Débloquer le build (obligatoire, 2 min)
```bash
cd /Users/remsko/Liste_Pearl
eas login          # ton compte Expo — JE NE PEUX PAS saisir ton mot de passe
```
Dis-moi « connecté » et je lance `eas build -p ios` + `-p android` (production).

### 2. Carte Android
Remplace `REMPLACE_PAR_TA_CLE_GOOGLE_MAPS_ANDROID` dans `app.json` par ta clé (Google Cloud → Maps SDK for Android). Ou dis-moi « désactive la carte Android » pour la v1.

### 3. Finir les fiches (dans les consoles — toi)
**App Store Connect** (le texte est déjà là) :
- Héberger la privacy policy → coller l'URL.
- **Captures d'écran** (6,5" + 6,7") — je peux les générer quand j'ai la main sur le simulateur.
- **Confidentialité de l'app** (questionnaire) : Localisation, Coordonnées, Achats, Identifiants.
- **Classification par âge** : répondre « non » partout → 4+.
- Uploader le build (via `eas submit` avec ta clé API ASC) → **Ajouter pour vérification** (LE clic final = toi).

**Google Play Console** (tout le texte est dans `store-listing.md`) : fiche + captures + Data safety + Content rating + upload AAB → Publier.

## 🔒 Ce que je n'ai jamais fait (règle de sécurité, même en autonomie totale)
Saisir un mot de passe / identifiant / clé API · cliquer « Ajouter pour vérification » / « Publier » · supprimer la fiche en double.

## Ordre au retour
1. `eas login` → je build.
2. Tu décides la carte Android + le doublon de fiche.
3. Je génère les captures ; tu finis confidentialité/âge + soumets.
