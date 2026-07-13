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
