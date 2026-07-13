# Clés & identifiants — Pearl List

> Recensement complet. Les clés **publiques** sont listées (elles sont déjà dans l'app, sans danger). Les clés **secrètes** ne sont JAMAIS écrites ici : seul leur emplacement est indiqué.

## ✅ Clés publiques / config (sans danger)

| Clé | Valeur |
|---|---|
| Stripe **publishable** key (live) | `pk_live_51R8hqCArfIzMjUBjIDVUlchS37nktlFM2cdugW3ocvqBwdi8GxPuKkaKTlnGdX2Qb0yVbAK9JivZlUOAvgygP8Pe00JEBclh24` |
| EAS project ID | `c2ae23d8-1884-47ae-b45c-feea16814db6` |
| Compte Expo (owner) | `localidad` |
| Bundle ID iOS | `com.pearlstreets.list` |
| Package Android | `com.pearlstreets.list` |
| Apple merchant ID (Apple Pay) | `merchant.com.pearlstreets.list` |
| URL scheme | `pearl-list` |
| App Store app ID (iOS) | `6762128624` (⚠️ + 1 fiche en doublon à identifier) |
| API prod | `https://api.pearlstreets.com/api/v1` |
| Version / build | `1.0.0` / iOS buildNumber `5`, Android versionCode `1` |

## ⚠️ Clé à FOURNIR (manquante)
| Clé | État | Où l'obtenir |
|---|---|---|
| Google Maps **Android** API key | ❌ placeholder dans `app.json` | Google Cloud Console → Maps SDK for Android |

## 🔒 Clés SECRÈTES (jamais ici — où elles vivent)

| Secret | Emplacement | Pour quoi |
|---|---|---|
| Stripe **secret** key (`sk_live`) | Backend Django (prod) uniquement | Créer/confirmer les paiements côté serveur |
| Certificat de distribution Apple + provisioning | **EAS** (géré auto) | Signer le build iOS |
| Keystore Android | **EAS** (géré auto) | Signer l'AAB |
| App Store Connect API key (`.p8`) | À générer : ASC → Utilisateurs et accès → Clés | `eas submit` iOS |
| Google Play service account (JSON) | À générer : Play Console → API access | `eas submit` Android |
| Token d'accès Expo | Optionnel (CI) | Builds non-interactifs |

## Note
Aucun secret n'est stocké dans le code de l'app (vérifié : pas de `.env`, pas de `sk_`, pas de clé API en dur). Les tokens `access_token`/`refresh_token` vus dans `services/auth.js` sont des **jetons de session runtime** (obtenus au login), pas des clés stockées.
