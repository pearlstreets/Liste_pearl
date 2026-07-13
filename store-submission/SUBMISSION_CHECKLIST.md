# Checklist de soumission publique — Pearl List (iOS + Android)

Légende : ✅ fait · 🟡 à faire (toi) · 🔵 à faire (moi, sur ta demande)

---

## PHASE 0 — L'app fonctionne
- ✅ Build Release compile et tourne (0 crash).
- ✅ Tunnel de paiement + 3DS **prouvé** en prod (commande `OXNI1BQY7U`, 0,50 € débités, reçue par le pro).
- ✅ UI corrigée : belle popup, retour auto 3DS, icônes d'états vides retirées, texte centré.
- 🟡 **À valider par toi** : un paiement de bout en bout sur le dernier build (appuie sur Payer + valide la 3DS) pour confirmer le retour auto fluide.

## PHASE 1 — Prod-readiness (code)
- ✅ `ACTIVE_ENV = production`, clé Stripe **live**, 0 `console.log`.
- ✅ Icône + splash déclarés dans `app.json`.
- 🟡 **Clé Google Maps Android** : remplace `REMPLACE_PAR_TA_CLE_GOOGLE_MAPS_ANDROID` dans `app.json` (`android.config.googleMaps.apiKey`) par ta clé (console Google Cloud → Maps SDK for Android). Sans elle : la carte de livraison reste vide sur Android (pas de crash), mais à corriger avant la v1 Android. Alternative : je désactive la carte sur Android (dis-le-moi).
- 🔵 Bump versions au moment du build : iOS `buildNumber` 5→6, Android `versionCode` 1→2 (je le fais avant `eas build`).

## PHASE 2 — Builds de production (EAS)
> EAS **n'est pas connecté** et je **ne peux pas** saisir tes identifiants.
- 🟡 **Toi** : `cd /Users/remsko/Liste_Pearl && eas login` (compte Expo `localidad`).
- 🟡 **Toi** : credentials — Apple Developer (compte payant actif) + keystore Android (EAS peut le générer).
- 🔵 **Moi (après ton login)** : `eas build --platform ios --profile production` et `eas build --platform android --profile production`.

## PHASE 3 — Fiches + soumission (consoles web — TOI)
> Je ne peux ni saisir d'identifiants ni cliquer « Soumettre ». Je fournis tout le contenu (`store-listing.md`, `privacy-policy.html`).

### App Store Connect (iOS)
- 🟡 Créer l'app (bundle `com.pearlstreets.list`).
- 🟡 Métadonnées : nom, sous-titre, description, mots-clés (→ `store-listing.md`).
- 🟡 **Captures d'écran** (6.7" + 6.5" obligatoires) — je peux les générer via simulateur (dis-le-moi).
- 🟡 **URL politique de confidentialité** (héberge `privacy-policy.html`).
- 🟡 **App Privacy** (nutrition label) : Localisation, Coordonnées (email/nom), Achats, Identifiants. « Données liées à l'utilisateur ». Pas de tracking publicitaire.
- 🟡 Prix : Gratuit. Disponibilité : pays visés.
- 🟡 Uploader le build (via `eas submit` avec ta clé API ASC, ou Transporter) puis **Soumettre pour examen**.
- ⚠️ **Note review Apple** : app de biens **physiques** → paiement Stripe autorisé (pas d'IAP). Fournir un **compte de démo** fonctionnel + préciser dans les notes que le paiement est réel (Stripe) pour des biens physiques.

### Google Play Console (Android)
- 🟡 Créer l'app (package `com.pearlstreets.list`).
- 🟡 Fiche : titre, descriptions courte/complète (→ `store-listing.md`).
- 🟡 **Captures** (téléphone) + icône 512×512 + bannière 1024×500.
- 🟡 **URL politique de confidentialité**.
- 🟡 **Data safety form** : mêmes données que l'App Privacy iOS.
- 🟡 **Content rating** (questionnaire IARC) → Tout public.
- 🟡 Uploader l'AAB (`eas submit` avec compte de service, ou upload manuel) → track **Production** → **Publier**.

---

## Ce que je NE ferai jamais (sécurité)
Saisir tes mots de passe / clés API stores / login EAS. Tu gardes la main sur tout ce qui est identifiant et sur le clic final « Soumettre ».

## Ordre recommandé
1. Toi : valider un paiement bout-en-bout (Phase 0) + décider carte Android (clé ou désactiver).
2. Moi : bump versions + (après ton `eas login`) lancer les 2 builds + générer les captures.
3. Toi : remplir les 2 consoles avec mes contenus + soumettre.
