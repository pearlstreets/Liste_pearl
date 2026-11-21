// Clés de stockage et constantes partagées (valeurs identiques à l'historique : ne pas renommer).
import { listItemsKey as listItemsKeyLib } from './listStore';

export const KEY_ITEMS = "SG_ITEMS";                 // liste ACTIVE (miroir — utilisé par l'ajout au panier)
export const KEY_LISTS = "SG_LISTS";                 // registre de MES listes : [{ id, name }]
export const KEY_ACTIVE_LIST = "SG_ACTIVE_LIST";     // id de la liste active
export const DEFAULT_LIST_ID = "default";
// Clé de stockage canonique des articles d'une liste donnée.
// Chaque liste (« default » comprise) a sa clé SG_ITEMS__<id> ; KEY_ITEMS = miroir de l'active.
export const listItemsKey = (id) => listItemsKeyLib(id);
export const KEY_SELECTED = "SG_SELECTED_FOR_PRODUCTS";

export const KEY_CART = "KEY_CART";
export const KEY_PENDING_PAYMENT = "SG_PENDING_PAYMENT"; // commandes Marketplace créées, en attente de paiement
export const KEY_ORDER_HISTORY = "KEY_ORDER_HISTORY";
export const KEY_PROFILE = "KEY_PROFILE";
export const KEY_FAV_SHOPS="KEY_FAV_SHOPS";
export const KEY_FAVS = "KEY_FAVS";
export const KEY_FAV_PRODUCTS = "KEY_FAV_PRODUCTS";
export const KEY_AUTH = "KEY_AUTH";
// Comptes : uniquement ceux du backend Marketplace. Aucun compte ni mot de
// passe n'est gardé en local (ancien registre KEY_ACCOUNTS effacé au démarrage).
export const GUTTER = 24;
export const CTRL = 20;
export const GAP = 10;

export const LANGUAGES = [
  { code:'fr', label:'Français', flag:'🇫🇷' },
  { code:'en', label:'English', flag:'🇬🇧' },
  { code:'es', label:'Español', flag:'🇪🇸' },
  { code:'zh', label:'中文', flag:'🇨🇳' },
  { code:'ar', label:'العربية', flag:'🇸🇦' },
  { code:'de', label:'Deutsch', flag:'🇩🇪' },
  { code:'nl', label:'Nederlands', flag:'🇳🇱' },
  { code:'it', label:'Italiano', flag:'🇮🇹' },
  { code:'pt', label:'Português', flag:'🇵🇹' },
  { code:'ja', label:'日本語', flag:'🇯🇵' },
  { code:'th', label:'ไทย', flag:'🇹🇭' },
  { code:'sv', label:'Svenska', flag:'🇸🇪' },
  { code:'ru', label:'Русский', flag:'🇷🇺' },
];
