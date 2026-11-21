# Organisation du code de Pearl List

L'ancien App.js (environ 9 100 lignes) a été découpé en 4 étapes, sans changer le comportement ni l'affichage. Le code a seulement été déplacé. Les clés AsyncStorage, les formats stockés et les noms d'événements DeviceEventEmitter sont inchangés.

## Point d'entrée

| Fichier | Rôle |
|---|---|
| `index.js` | Enregistre la racine Expo dans un SafeAreaProvider (inchangé). |
| `App.js` | Réexporte seulement la racine de `app/Racine.js`. |

## app/ : racine de l'application

| Fichier | Rôle |
|---|---|
| `app/Racine.js` | Composant racine : session, choix de la langue au premier lancement, devise et taux en direct, notifications push, OTA rapide, synchro et rappels Menus, fenêtre de connexion, NavigationContainer et navRef (liens pearl-list://partage, onglet rouvert après un changement de langue). Garde l'import de `services/pushToucher` en premier. |
| `app/MainNavigator.js` | Barre d'onglets (Ma Liste, Menus, Produits, Boutiques, Panier, Profil), ses icônes, ses libellés et le badge du panier (KEY_CART, CART_UPDATED, CART_COUNT_CHANGED). |
| `app/MargesCotes.js` | Marges gauche et droite appliquées une seule fois pour l'écran extérieur de l'iPhone Duo, puis remises à zéro pour les écrans en dessous. |

## lib/ : constantes et aides sans affichage

| Fichier | Rôle |
|---|---|
| `lib/constants.js` | Clés de stockage (KEY_*, SG_*, listItemsKey), GUTTER, CTRL, GAP et LANGUAGES. |
| `lib/sousCategorie.js` | Aide sur les sous-catégories, utilisée par Produits et Boutiques. |
| `lib/photon.js` | Suggestions d'adresses (fetchPhotonSuggestions), pour l'inscription et le profil. |

## components/commun/ : petits éléments partagés

| Fichier | Rôle |
|---|---|
| `components/commun/theme.js` | Couleurs BRAND et THEME, INSET_BAS. |
| `components/commun/styles.js` | Ancien objet `styles` d'App.js. |
| `components/commun/lstyles.js` | Styles de la liste, repris aussi par la roulette de date et le profil. |
| `components/commun/devise.js` | CurrencyContext unique et useCurrency. |
| `components/commun/ProductImage.js` | ProductThumb et ProductImage. |
| `components/commun/QtyInput.js` | Champ de quantité. |
| `components/commun/DragWrap.js` | Enveloppe de glisser-déposer. |
| `components/commun/Coches.js` | Cases à cocher Square et Radio. |

## screens/auth/ : connexion et premier lancement

| Fichier | Rôle |
|---|---|
| `screens/auth/AuthScreen.js` | Connexion et inscription (authStyles, mode mémorisé, oublierModeAuth). |
| `screens/auth/WheelDatePicker.js` | Roulette de date de naissance (WheelColumn). |
| `screens/auth/FirstLaunchLanguage.js` | Choix de la langue au premier lancement. |
| `screens/auth/validation.js` | Expressions de validation (e-mail, mot de passe, téléphone, pseudo) et normalizeDob. |
| `screens/auth/session.js` | Option « Rester connecté » et purge de session au démarrage. |

## screens/shop/ : produits, boutiques, favoris

| Fichier | Rôle |
|---|---|
| `screens/shop/ProductsScreen.js` | Onglet Produits : recherche, fiche produit et comparateur. |
| `screens/shop/ShopsScreen.js` | Onglet Boutiques, avec la fiche boutique. |
| `screens/shop/FavoritesScreen.js` | Favoris, ouverts depuis le profil. |

## screens/cart/ : panier, commande, suivi

| Fichier | Rôle |
|---|---|
| `screens/cart/CartScreen.js` | Onglet Panier et tunnel de commande, paiement compris (useSecureScreen, marquerPaiement, modale DeuxEcrans « figer »). |
| `screens/cart/OrderTracker.js` | Suivi d'une commande. |
| `screens/cart/cartStyles.js` | Styles partagés par le panier et le suivi. |
| `screens/cart/adresses.js` | Mise en forme des adresses enregistrées (formatSavedAddress, formatAddressContact). |
| `screens/cart/orders/useCommandes.js` | Hook des commandes : historique, statuts, relevés de livraison, pourboire, note, signalement, annulation. |
| `screens/cart/orders/HistoriqueCommandes.js` | Aperçu des 3 dernières commandes et fenêtre de toutes les commandes. |
| `screens/cart/orders/DetailCommande.js` | Détail d'une commande et feuille « Recommander ». |

## screens/list/ : Ma Liste et partage

| Fichier | Rôle |
|---|---|
| `screens/list/ListScreen.js` | Onglet Ma Liste, avec ses fenêtres de listes et de partage. |
| `screens/list/DemandesPartage.js` | Hook et fenêtre des demandes de partage (accepter, refuser, bloquer). |

## screens/profile/ : profil

| Fichier | Rôle |
|---|---|
| `screens/profile/ProfileScreen.js` | Onglet Profil (FakeProfileScreen) : compte, adresses, préférences, livreur, ouvertures depuis les notifications. |
| `screens/profile/profStyles.js` | Styles du profil, des commandes et des demandes de partage. |
| `screens/profile/LegalLinks.js` | Liens publics vers la politique de confidentialité et les conditions d'utilisation. |

## Inchangé

`components/menus/` (environ 30 tests en dépendent), `components/ui/`, les autres `components/`, `services/`, `utils/`, `data/`, `locales/` et `i18n.js`.
