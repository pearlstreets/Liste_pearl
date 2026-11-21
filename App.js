// Toucher des notifications de commande : importé en premier, l'abonnement est
// pris au chargement du module (toucher qui lance l'app compris).
import { brancherNavigation, consommerDestination, oublierDestination, definirConnexion, prendreCommandeAOuvrir, trouverCommande, EVENEMENT_OUVRIR, EVENEMENT_PARTAGE, ouvrirDemandesPartage, prendrePartageAOuvrir } from "./services/pushToucher";
import { demanderPermission, enregistrerAppareil } from "./services/pushDirect";
import { autocorrectName } from "./utils/spellcheck";
import React, { useEffect, useMemo, useState } from "react";

// Marketplace API Services
import { logoutUser, deleteAccount as apiDeleteAccount, forgotPassword as apiForgotPassword, updatePassword as apiUpdatePassword, getDocumentStatus, clearLocalUserData, purgeLegacyLocalAccounts } from "./services/auth";
import { getSharedWithMe, syncMyList, getMyList, sendShareRequest, getIncomingRequests, respondRequest, revokeShare, getBlocks, blockUser, blockUserById, unblockUser, searchUsers, getGrantedShares, getPublicProfile } from "./services/sharedLists";
import { getAllProducts, getCompanyProducts, searchProducts as apiSearchProducts, getCategories, getShopsByCategory } from "./services/products";
import { annulationPossible, refusAnnulation } from "./lib/annulation";
import { ajouterAuPanier, champsCommande } from "./lib/panier";
import { getAllShops, getShopDetails } from "./services/shops";
import { getCart, saveCart, addToCart as apiAddToCart, removeFromCart as apiRemoveFromCart, getMarketplaceOrderStatuses } from "./services/orders";
import { getProfile as apiGetProfile, updateProfile as apiUpdateProfile, uploadProfilePhoto } from "./services/profile";
import { fetchAddresses, createAddress, updateAddress, deleteAddressById, makeAddressDefault } from "./services/addresses";
import { getTokens } from "./services/api";
import { LEGAL_URLS } from "./services/config";
import { getSecureItem, setSecureItem } from "./services/secureStorage";
import { cancelDelivery, trackDelivery, getDeliveryStatus, addDeliveryTip, reportDeliveryProblem, rateDelivery, DELIVERY_STATUS, getDeliveryStatusInfo, toggleDriverMode, isDriverMode, getDriverEarnings, canDeliver, getDriverCountry, setDriverCountry, COUNTRY_LIMITS, getCountryLimit } from "./services/delivery";
import LiveDeliveryMap from "./components/LiveDeliveryMap";
import PaymentMethodsModal from "./components/PaymentMethodsModal";


function itemsToRenderForShop(allUserItems, assignedForThisShop, optimized){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  const opt = typeof optimized === "boolean" ? optimized : false;
  return opt ? B : A;
}

import i18nApi, { CLE_ONGLET_APRES_RECHARGEMENT, definirOngletApresRechargement } from './i18n';
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter, AppState } from 'react-native';
// Modal de react-native, sauf sur l'ecran deplie d'un pliable Android :
// liste a gauche, page ouverte a droite (voir le fichier).
import Modal, { DeuxEcrans, AuMilieu } from './components/DeuxEcrans';
import * as Location from 'expo-location';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Keyboard, FlatList, Pressable, Alert, ActivityIndicator, Image, Animated, ScrollView, Platform, KeyboardAvoidingView, InputAccessoryView, Linking } from "react-native";
import { SafeAreaView, SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReorderableList from "react-native-reorderable-list";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DefaultTheme, useNavigation, useFocusEffect, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "./components/ui/IoniconsSens";
import { loadListItems, persistActiveItems } from "./lib/listStore";
import { listItemPack } from "./lib/menus/shopping";
import MenusScreen from "./components/menus/MenusScreen";
import { startMenusSync, flushMenusSync } from "./services/menusSync";
import { startMenuReminders, onMenuReminderOpen, hasPendingMenuReminder } from "./services/menuReminders";
import TabLabel from "./components/menus/TabLabel";
import { demarrerOtaRapide } from "./services/otaRapide";
import * as ImagePicker from 'expo-image-picker';

import { openCamera } from "./utils/openCamera";
import RepeatButton from "./components/ui/RepeatButton";
import { MARCHE, SERIF, TAILLES } from "./components/ui/marche";
import { PRODUCT_IMAGES, DEFAULT_PRODUCT, CATEGORY_FALLBACKS } from "./lib/productImages";
import { CURRENCIES } from "./data/currencies";
import { RATES_CACHE_MS, fetchLiveRates, getCurrencyWithLiveRate, getCachedLiveRates } from "./lib/rates";
import { parseMulti } from "./lib/parseMulti";
import { BRAND, INSET_BAS, THEME } from "./components/commun/theme";
import { lstyles } from "./components/commun/lstyles";
import { CurrencyContext, useCurrency } from "./components/commun/devise";
import { ProductThumb } from "./components/commun/ProductImage";
import { QtyInput } from "./components/commun/QtyInput";
import { DragWrap } from "./components/commun/DragWrap";
import { Square } from "./components/commun/Coches";
import { KEY_ITEMS, KEY_LISTS, KEY_ACTIVE_LIST, DEFAULT_LIST_ID, listItemsKey, KEY_SELECTED, KEY_CART, KEY_ORDER_HISTORY, KEY_PROFILE, KEY_AUTH, LANGUAGES } from "./lib/constants";
import { fetchPhotonSuggestions } from "./lib/photon";
import AuthScreen, { oublierModeAuth } from "./screens/auth/AuthScreen";
import FirstLaunchLanguage from "./screens/auth/FirstLaunchLanguage";
import { purgerSessionSiNonConservee } from "./screens/auth/session";
import ProductsScreen from "./screens/shop/ProductsScreen";
import FavoritesScreen from "./screens/shop/FavoritesScreen";
import ShopsScreen from "./screens/shop/ShopsScreen";
import CartScreen from "./screens/cart/CartScreen";
import { formatSavedAddress } from "./screens/cart/adresses";











const Tab = createBottomTabNavigator();
// Notification de rappel touchée : ouverture de l'onglet Menus, qui prend ensuite le bon écran.
const navRef = createNavigationContainerRef();
// Notification de commande touchée : Profil puis détail (services/pushToucher.js).
brancherNavigation(navRef);
const ouvrirMenusDepuisRappel = () => {
  if (navRef.isReady() && hasPendingMenuReminder()) navRef.navigate('menus');
};
// Lien pearl-list://partage (notification touchée dans l'app Pearl Streets) :
// Profil puis « Demandes de partage », au lancement comme app déjà ouverte.
const estLienPartage = (url) => typeof url === 'string' && /^pearl-list:\/\/+partage/i.test(url);
try {
  Linking.getInitialURL().then((u) => { if (estLienPartage(u)) ouvrirDemandesPartage(); }).catch(() => {});
  Linking.addEventListener('url', (e) => { if (estLienPartage(e && e.url)) ouvrirDemandesPartage(); });
} catch {}
// Onglet mémorisé avant un rechargement dû au changement de langue : lu une
// seule fois au démarrage, effacé aussitôt, ouvert quand la navigation est prête.
let ongletApresRechargement = AsyncStorage.getItem(CLE_ONGLET_APRES_RECHARGEMENT)
  .then((nom) => {
    if (nom) AsyncStorage.removeItem(CLE_ONGLET_APRES_RECHARGEMENT).catch(() => {});
    return nom;
  })
  .catch(() => null);
const ouvrirOngletApresRechargement = () => {
  const lecture = ongletApresRechargement;
  ongletApresRechargement = null;
  if (lecture) lecture.then((nom) => { if (nom && navRef.isReady()) navRef.navigate(nom); });
};
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: BRAND, background: "#fff" } };





// Toast and RepeatButton extracted to components/ui/


function ListScreen() {
  const { t, i18n: i18nListe } = useTranslation();
  // Conditionnement des articles venus de Menus (« 1 tête », « 1 kg »), dans la langue de l'application.
  const langueListe = i18nListe.language;
  const optsPaquet = useMemo(() => ({
    lang: langueListe,
    labels: { g: t('menus.units.g'), kg: t('menus.units.kg'), ml: t('menus.units.ml'), l: t('menus.units.l'), u: t('menus.units.u') },
  }), [t, langueListe]);
  const tMenus = React.useCallback((k, o) => t('menus.' + k, o), [t]);
  const navigation = useNavigation();
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [strikeAll, setStrikeAll] = useState(false);
  const [hideCrossed, setHideCrossed] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const [unitPickerId, setUnitPickerId] = useState(null);

  // --- Partage de listes (compte marketplace unifié) ---
  const [sharedLists, setSharedLists] = useState([]);          // listes partagées AVEC moi (lecture seule)
  const [viewingShareId, setViewingShareId] = useState(null);  // null = MA liste
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareInput, setShareInput] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareSuggestions, setShareSuggestions] = useState([]);
  const [shareInputKey, setShareInputKey] = useState(0); // remonte l'input non contrôlé après un choix
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [granted, setGranted] = useState({ accepted: [], pending: [], count: 0 }); // qui a accès à MA liste
  const [grantedOpen, setGrantedOpen] = useState(false);
  // Pop-up « profil Pearl Streets » d'une personne de « Qui a accès à ma liste ».
  const [profilPartage, setProfilPartage] = useState(null); // { username, user?, loading }
  // Ouvre la fenêtre de partage (bouton « Partager » et « Ajouter une personne »).
  const ouvrirPartage = () => {
    setShareInput(''); setShareInputKey((k) => k + 1); setShareModalOpen(true);
    // Connecté : liste des utilisateurs affichée d'emblée (cache -> instantané).
    // Sans compte : aucune suggestion d'autres utilisateurs (vie privée).
    setShareSuggestions(isLoggedIn ? (shareCache.current.get('') || []) : []);
    getTokens().then((tok) => {
      setIsLoggedIn(!!tok);
      if (tok) fetchShareUsers('');
      else { shareReqId.current++; shareCache.current.clear(); setShareSuggestions([]); }
    }).catch(() => {});
  };
  const ouvrirProfilPartage = async (u) => {
    const username = u?.username;
    if (!username) return;
    setProfilPartage({ username, user: { ...u }, loading: true });
    try {
      const r = await getPublicProfile(username);
      const pu = r && (r.user || r.data?.user);
      setProfilPartage((p) => (p && p.username === username ? { username, user: { ...u, ...(pu || {}) }, loading: false } : p));
    } catch {
      setProfilPartage((p) => (p && p.username === username ? { ...p, loading: false } : p));
    }
  };
  const shareDebounce = React.useRef(null);
  const shareCache = React.useRef(new Map()); // requête -> résultats (affichage instantané)
  const shareReqId = React.useRef(0);         // ignore les réponses réseau périmées

  // --- Multi-listes (MES listes) ---
  const [myLists, setMyLists] = useState([{ id: DEFAULT_LIST_ID, name: '' }]);
  const [activeListId, setActiveListId] = useState(DEFAULT_LIST_ID);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameName, setRenameName] = useState('');
  // Refs pour focus fiable des inputs en modale (New Arch : autoFocus peu fiable).
  const createInputRef = React.useRef(null);
  const renameInputRef = React.useRef(null);
  const shareInputRef = React.useRef(null);
  const editInputRef = React.useRef(null);
  const activeListName = (myLists.find(l => l.id === activeListId)?.name) || t('tabs.myList');
  const activeShared = viewingShareId != null
    ? sharedLists.find(l => String(l.share_id) === String(viewingShareId))
    : null;
  const readOnly = !!activeShared;
  const sourceItems = readOnly ? (Array.isArray(activeShared.items) ? activeShared.items : []) : items;

  // Charge les listes partagées avec moi (si connecté), au focus de l'écran.
  useFocusEffect(React.useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const tok = await getTokens();
        if (alive) setIsLoggedIn(!!tok);
        if (!tok) { if (alive) { setSharedLists([]); setViewingShareId(null); } return; }
        // Connexion faite depuis un autre écran : « Ma liste » du serveur est lue
        // avant tout envoi (reprendreMaListe).
        if (alive && hydrated.current && !serveurLuRef.current) reprendreMaListe();
        const res = await getSharedWithMe();
        if (alive && res && res.status) setSharedLists(res.data?.lists || []);
        const g = await getGrantedShares();
        if (alive && g && g.status && g.data) {
          setGranted({ accepted: g.data.accepted || [], pending: g.data.pending || [], count: g.data.count || 0 });
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []));

  // Synchronise « Ma liste » (la liste par défaut) vers le serveur pour le partage.
  // IMPORTANT : seule la liste par défaut est partagée. Les listes nommées
  // supplémentaires restent privées/locales — on ne pousse JAMAIS leur contenu
  // vers le slot serveur unique, sinon basculer/créer une liste écraserait ou
  // viderait ce que voient les personnes avec qui « Ma liste » est partagée.
  useEffect(() => {
    if (!hydrated.current) return;
    if (activeListId !== DEFAULT_LIST_ID) return;
    // Jamais d'envoi avant d'avoir lu la liste du serveur : un téléphone neuf
    // (liste locale vide) écraserait celle du compte.
    if (!serveurLuRef.current) return;
    const tm = setTimeout(async () => {
      try {
        const tok = await getTokens();
        if (tok) await syncMyList(items, '');
      } catch {}
    }, 1500);
    return () => clearTimeout(tm);
  }, [items, activeListId]);

  const hydrated = React.useRef(false);
  const externalReload = React.useRef(false); // un rechargement (ajout depuis Menus) a déjà eu lieu
  // « Ma liste » du serveur lue (connecté) : l'envoi vers le serveur est permis.
  const serveurLuRef = React.useRef(false);
  // Connecté : si « Ma liste » (par défaut) est VIDE sur l'appareil (téléphone
  // neuf, après une déconnexion), elle est remplie avec celle du serveur ; sinon
  // la liste locale est gardée. L'envoi n'est permis qu'après cette lecture.
  const reprendreMaListe = React.useCallback(async () => {
    try {
      const tok = await getTokens();
      if (!tok) return;
      const act = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
      const locale = await loadListItems(DEFAULT_LIST_ID, act);
      if (!locale.ok) return; // illisible : ni reprise ni envoi
      if (locale.items.length > 0) { serveurLuRef.current = true; return; }
      const r = await getMyList();
      const srv = (r && r.status !== false && r.data && Array.isArray(r.data.items))
        ? r.data.items.filter(it => it && typeof it === 'object' && !Array.isArray(it)) : null;
      if (!srv) return; // serveur injoignable : pas d'envoi (la liste du compte est gardée)
      if (srv.length > 0) {
        // Toujours vide (rien ajouté pendant la lecture) : sinon la locale prime.
        const encore = await loadListItems(DEFAULT_LIST_ID, act);
        if (!encore.ok) return;
        if (encore.items.length === 0) {
          const payload = JSON.stringify(srv);
          await AsyncStorage.setItem(listItemsKey(DEFAULT_LIST_ID), payload);
          const actNow = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
          if (actNow === DEFAULT_LIST_ID) {
            await AsyncStorage.setItem(KEY_ITEMS, payload);
            setItems(srv);
          }
        }
      }
      serveurLuRef.current = true;
    } catch {}
  }, []);
  // Une écriture venue d'ailleurs (onglet Menus) recharge la liste active depuis le stockage.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('LISTS_UPDATED', async () => {
      try {
        const act = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
        const r = await loadListItems(act, act);
        if (!r.ok) return;
        if (!hydrated.current) externalReload.current = true;
        setItems(r.items);
      } catch {}
    });
    return () => sub.remove();
  }, []);
  useEffect(() => { (async () => {
    let lisible = true;
    try {
      // Registre de MES listes (migration : crée 'default' si absent). Registre
      // illisible : repli sur la liste par défaut, sans écrire par-dessus.
      let lists = null;
      let registreLisible = true;
      try { lists = JSON.parse((await AsyncStorage.getItem(KEY_LISTS)) || 'null'); }
      catch { lists = null; registreLisible = false; }
      if (!Array.isArray(lists) || lists.length === 0) {
        lists = [{ id: DEFAULT_LIST_ID, name: '' }];
        if (registreLisible) await AsyncStorage.setItem(KEY_LISTS, JSON.stringify(lists));
      }
      setMyLists(lists);
      let active = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
      if (!lists.some(l => l.id === active)) active = DEFAULT_LIST_ID;
      setActiveListId(active);
      // Articles de la liste active — KEY_ITEMS reste le miroir de l'active (compat panier)
      const { ok, items: parsed } = await loadListItems(active, active);
      // Liste illisible : rien n'est affiché ni écrit par-dessus (hydrated reste faux).
      lisible = ok;
      if (ok && !externalReload.current) setItems(parsed);
      if (ok && !externalReload.current) await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify(parsed));
    } catch {}
    if (!lisible) return;
    hydrated.current = true;
    reprendreMaListe();
  })(); }, []);
  // Déconnexion ou suppression du compte : les listes ont été effacées de
  // l'appareil, on vide aussi celles affichées en mémoire.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('USER_DATA_CLEARED', () => {
      serveurLuRef.current = false;
      setMyLists([{ id: DEFAULT_LIST_ID, name: '' }]);
      setActiveListId(DEFAULT_LIST_ID);
      setItems([]);
      setSharedLists([]);
      setViewingShareId(null);
      setGranted({ accepted: [], pending: [], count: 0 });
      setIsLoggedIn(false);
      shareCache.current.clear();
    });
    return () => sub.remove();
  }, []);
  // Persist only after the initial load — otherwise the empty initial state
  // overwrites the saved list on every cold start.
  useEffect(() => {
    if (!hydrated.current) return;
    persistActiveItems(activeListId, items).catch(() => {}); // canonique de l'active + miroir (compat panier)
  }, [items, activeListId]);

  // Reload items when returning to this tab (e.g. after adding to cart crosses them off)
  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem("SG_ITEMS");
        if (s) { const v = JSON.parse(s); if (Array.isArray(v)) setItems(v); }
      } catch {}
    })();
  }, []));

  const addFromInput = () => {
    const parsed = parseMulti(text);
    if (parsed.length === 0) return;
    setItems(prev => {
      const base = [...prev];
      for (const p of parsed) {
        const idx = base.findIndex(b => b.name.toLowerCase() === p.name.toLowerCase() && (b.unit || 'u') === (p.unit || 'u'));
        if (idx >= 0) base[idx] = { ...base[idx], qty: (base[idx].qty || 1) + p.qty };
        else base.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name: p.name, qty: p.qty, unit: p.unit || 'u', crossed: false, selected: true });
      }
      return base;
    });
    setText("");
    Keyboard.dismiss();
  };

  const onMinus = id => setItems(items.map(it => it.id === id ? { ...it, qty: Math.max(1, (it.qty || 1) - 1) } : it));
  const onPlus  = id => setItems(items.map(it => it.id === id ? { ...it, qty: (it.qty || 1) + 1 } : it));
  const setQty  = (id, q) => setItems(items.map(it => it.id === id ? { ...it, qty: q } : it));
  const setUnit = (id, u) => setItems(items.map(it => it.id === id ? { ...it, unit: u } : it));
  const toggleSelected = id => setItems(items.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleCrossed  = id => setItems(items.map(it => it.id === id ? { ...it, crossed: !it.crossed, selected: it.crossed ? it.selected : false } : it));

  const toggleSelectAll = () => {
    const v = !selectAll; setSelectAll(v);
    setItems(items.map(it => ({ ...it, selected: v })));
  };
  const toggleStrikeAll = () => {
    const v = !strikeAll; setStrikeAll(v);
    setItems(items.map(it => ({ ...it, crossed: v, selected: v ? false : it.selected })));
  };

  // Les articles barrés descendent TOUJOURS en bas de liste, sans perdre leur
  // ordre relatif (tri stable) ni celui des articles restants. L'ordre manuel
  // (flèches) porte donc sur les articles actifs, ce qui est ce qu'on veut.
  // Deux listes séparées : la liste DÉPLAÇABLE ne contient que les articles
  // actifs, les barrés sont rendus dans un pied de liste fixe. Ils sont donc
  // toujours en bas par construction, et aucun glisser-déposer ne peut les
  // atteindre — c'est ce qui garantit que l'affichage ne peut pas se
  // désynchroniser des données.
  const activeItems = useMemo(() => sourceItems.filter(i => i && !i.crossed), [sourceItems]);
  const crossedItems = useMemo(
    () => (hideCrossed ? [] : sourceItems.filter(i => i && i.crossed)),
    [sourceItems, hideCrossed],
  );

  const openEdit = (it) => { setEditId(it.id); setEditText(it.name); setEditVisible(true); };
  const closeEdit = () => { setEditVisible(false); setEditId(null); setEditText(""); };
  const saveEdit = () => {
    if (!editText.trim()) { closeEdit(); return; }
    setItems(prev => prev.map(it => it.id === editId ? { ...it, name: editText.trim() } : it));
    closeEdit();
  };

  // --- Multi-listes : bascule / création / suppression ---
  const switchOwnList = async (id) => {
    if (id === activeListId && viewingShareId == null) { setSwitcherOpen(false); return; }
    try {
      // La liste SORTANTE est déjà persistée par l'effet de persistance (il flush
      // avant ce handler d'événement). On ne ré-écrit donc PAS la liste courante
      // ici : cela éviterait de ressusciter une clé qu'on vient de supprimer
      // (deleteList) et supprime des écritures AsyncStorage redondantes.
      const parsed = (await loadListItems(id, activeListId)).items;
      setActiveListId(id);
      setItems(parsed);
      setViewingShareId(null);
      setSelectAll(false); setStrikeAll(false);
      await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify(parsed)); // miroir immédiat (panier)
      await AsyncStorage.setItem(KEY_ACTIVE_LIST, id);
    } catch {}
    setSwitcherOpen(false);
  };

  // Création via modale custom (cross-platform iOS + Android — Alert.prompt est iOS-only).
  const createList = () => {
    setSwitcherOpen(false);
    setNewListName('');
    setCreateListOpen(true);
  };
  const confirmCreateList = async () => {
    const nm = (newListName || '').trim();
    if (!nm) { setCreateListOpen(false); return; }
    const id = 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const next = [...myLists, { id, name: nm }];
    setMyLists(next);
    try {
      await AsyncStorage.setItem(KEY_LISTS, JSON.stringify(next));
      await AsyncStorage.setItem(listItemsKey(id), JSON.stringify([]));
    } catch {}
    setCreateListOpen(false);
    await switchOwnList(id);
  };

  const deleteList = (id) => {
    if (id === DEFAULT_LIST_ID) return;
    Alert.alert(
      t('listScreen.deleteListTitle', 'Supprimer la liste'),
      t('listScreen.deleteListConfirm', 'Cette liste et son contenu seront supprimés.'),
      [
        { text: t('listScreen.cancel'), style: 'cancel' },
        { text: t('listScreen.delete'), style: 'destructive', onPress: async () => {
          try {
            const next = myLists.filter(l => l.id !== id);
            setMyLists(next);
            await AsyncStorage.setItem(KEY_LISTS, JSON.stringify(next));
            await AsyncStorage.removeItem(listItemsKey(id));
            if (activeListId === id) await switchOwnList(DEFAULT_LIST_ID);
          } catch {}
        }},
      ]
    );
  };

  // Renommage d'une liste (modale custom cross-platform).
  const renameList = (l) => {
    setSwitcherOpen(false);
    setRenameId(l.id);
    setRenameName(l.name || (l.id === DEFAULT_LIST_ID ? t('tabs.myList') : ''));
    setRenameOpen(true);
  };
  const confirmRenameList = async () => {
    const nm = (renameName || '').trim();
    if (!nm || !renameId) { setRenameOpen(false); return; }
    const next = myLists.map(l => l.id === renameId ? { ...l, name: nm } : l);
    setMyLists(next);
    try { await AsyncStorage.setItem(KEY_LISTS, JSON.stringify(next)); } catch {}
    setRenameOpen(false);
    setRenameId(null);
  };

  // Suggestions de pseudo pendant la saisie (recherche par @pseudo / display_name).
  // Un email n'est pas cherché : le backend le résout directement à l'envoi.
  // Récupère + met en cache une requête (vide = liste de tous les utilisateurs).
  const fetchShareUsers = async (q) => {
    const reqId = ++shareReqId.current;
    try {
      const res = await searchUsers(q);
      if (reqId !== shareReqId.current) return; // réponse périmée : on ignore
      const users = (res && Array.isArray(res.data) ? res.data : []).slice(0, 6);
      shareCache.current.set(q, users);
      setShareSuggestions(users);
    } catch { /* on garde l'affichage local déjà présent */ }
  };

  // Affichage INSTANTANÉ (façon Instagram) : on montre immédiatement le cache
  // exact ou un filtrage local d'un préfixe déjà chargé, puis on rafraîchit
  // via le réseau avec un debounce très court.
  const onShareInputChange = (text) => {
    setShareInput(text);
    if (shareDebounce.current) clearTimeout(shareDebounce.current);
    if (!isLoggedIn) { setShareSuggestions([]); return; } // sans compte : aucune suggestion
    const raw = (text || '').trim();
    const q = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();
    if (q.includes('@')) { setShareSuggestions([]); return; } // email : pas de suggestion

    const cached = shareCache.current.get(q);
    if (cached) {
      setShareSuggestions(cached);
    } else {
      // Filtre localement le résultat d'un préfixe déjà connu -> zéro latence.
      for (let i = q.length - 1; i >= 0; i--) {
        const prev = shareCache.current.get(q.slice(0, i));
        if (prev) {
          setShareSuggestions(prev.filter(u =>
            (u.username || '').toLowerCase().includes(q) ||
            (u.display_name || u.firstName || '').toLowerCase().includes(q)
          ));
          break;
        }
      }
    }
    shareDebounce.current = setTimeout(() => fetchShareUsers(q), 120);
  };
  const pickShareUser = (u) => {
    if (shareDebounce.current) clearTimeout(shareDebounce.current);
    setShareInput(u.username || '');
    setShareInputKey((k) => k + 1); // remonte l'input non contrôlé pour afficher le pseudo choisi
    setShareSuggestions([]);
  };

  // Envoi d'une demande de partage — réutilisé par le bouton ET la touche Entrée du clavier.
  const submitShareRequest = async () => {
    const id = (shareInput || '').trim();
    if (!id || shareBusy) return;
    setShareBusy(true);
    try {
      const res = await sendShareRequest(id);
      const ok = !!(res && res.status);
      if (ok) { setShareModalOpen(false); setShareInput(''); }
      Alert.alert(
        ok ? t('listScreen.shareSentTitle', 'Demande envoyée') : t('listScreen.shareFailedTitle', 'Échec'),
        (res && res.message) || (ok ? t('listScreen.shareSentMsg', 'La personne recevra votre demande de partage à accepter.') : t('listScreen.shareFailedMsg', "Impossible d'envoyer la demande."))
      );
    } catch (e) {
      Alert.alert(t('listScreen.shareFailedTitle', 'Échec'), t('auth.errorNetwork', 'Connexion au serveur impossible.'));
    }
    setShareBusy(false);
  };

  // Rendu d'une ligne. `drag` n'est fourni que pour les articles actifs de la
  // liste déplaçable ; les barrés sont rendus sans lui (pied de liste fixe).
  const renderRow = (item, drag) => {
    const isCrossed = !!item.crossed;
    const paquet = listItemPack(item, tMenus, optsPaquet);
    if (readOnly) {
      // Vue lecture seule d'une liste partagée par quelqu'un d'autre.
      return (
        <View style={[lstyles.card, isCrossed && { opacity: 0.55 }]}>
          <View style={[lstyles.check, item.selected && !isCrossed && lstyles.checkOn]}>
            {item.selected && !isCrossed ? <Ionicons name="checkmark" size={15} color={MARCHE.blanc} /> : null}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} style={[lstyles.itemName, isCrossed && lstyles.itemNameCrossed]}>{paquet.name}</Text>
            {paquet.detail ? <Text numberOfLines={1} style={lstyles.itemPack}>{paquet.detail}</Text> : null}
          </View>
          <Text style={lstyles.stepQty}>{(item.qty || 1)}{item.unit && item.unit !== 'u' ? ' ' + item.unit : ''}</Text>
        </View>
      );
    }
    return (
    <Pressable
      onLongPress={drag}
      delayLongPress={220}
      style={({ pressed }) => [lstyles.card, isCrossed && { opacity: 0.62 }, pressed && drag && { opacity: 0.9 }]}
      accessibilityHint={drag ? t('listScreen.dragHint', 'Appui long pour déplacer') : undefined}
    >
      {/* Select checkbox */}
      <TouchableOpacity onPress={() => !isCrossed && toggleSelected(item.id)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <View style={[lstyles.check, item.selected && !isCrossed && lstyles.checkOn]}>
          {item.selected && !isCrossed ? <Ionicons name="checkmark" size={15} color={MARCHE.blanc} /> : null}
        </View>
      </TouchableOpacity>

      {/* Name — tap to edit, appui long pour déplacer la ligne */}
      <TouchableOpacity onPress={() => !isCrossed && openEdit(item)} onLongPress={drag} delayLongPress={220} activeOpacity={0.7} style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
        <Text numberOfLines={1} style={[lstyles.itemName, isCrossed && lstyles.itemNameCrossed]}>{paquet.name}</Text>
        {paquet.detail ? <Text numberOfLines={1} style={lstyles.itemPack}>{paquet.detail}</Text> : null}
      </TouchableOpacity>

      {/* Quantity stepper */}
      <View style={[lstyles.stepper, isCrossed && { opacity: 0.5 }]}>
        <RepeatButton onPress={() => !isCrossed && onMinus(item.id)} onLongAction={() => !isCrossed && onMinus(item.id)} style={lstyles.stepBtn}><Ionicons name="remove" size={14} color={THEME.ink} /></RepeatButton>
        {isCrossed ? (
          <Text style={lstyles.stepQty}>{item.qty || 1}</Text>
        ) : (
          <QtyInput value={item.qty || 1} onCommit={(q) => setQty(item.id, q)} />
        )}
        <RepeatButton onPress={() => !isCrossed && onPlus(item.id)} onLongAction={() => !isCrossed && onPlus(item.id)} style={lstyles.stepBtn}><Ionicons name="add" size={14} color={THEME.ink} /></RepeatButton>
      </View>

      {/* Unit chip — tap to choose kg/g/L/mL/cL/mg */}
      <TouchableOpacity
        onPress={() => !isCrossed && setUnitPickerId(item.id)}
        activeOpacity={0.7}
        disabled={isCrossed}
        hitSlop={{top:6,bottom:6,left:4,right:4}}
        style={[lstyles.unitChip, (item.unit && item.unit !== 'u') && lstyles.unitChipOn, isCrossed && { opacity: 0.5 }]}
      >
        <Text style={[lstyles.unitChipTxt, (item.unit && item.unit !== 'u') && lstyles.unitChipTxtOn]} numberOfLines={1}>
          {item.unit && item.unit !== 'u' ? item.unit : t('listScreen.unitPiece', 'u')}
        </Text>
      </TouchableOpacity>

      {/* Done toggle */}
      <TouchableOpacity onPress={() => toggleCrossed(item.id)} activeOpacity={0.7} style={{ marginLeft: 10 }}>
        <View style={[lstyles.doneBtn, isCrossed && lstyles.doneBtnOn]}>
          <Ionicons name="checkmark" size={15} color={isCrossed ? '#fff' : THEME.faint} />
        </View>
      </TouchableOpacity>
    </Pressable>
    );
  };

  // Ligne de la liste DÉPLAÇABLE : uniquement des articles actifs, donc tout
  // couple (from, to) y est valide — plus aucun cas où l'on refuserait le
  // déplacement, ce qui désynchronisait l'affichage des données.
  const renderItem = ({ item }) => (
    <DragWrap enabled={activeItems.length > 1}>
      {(drag) => renderRow(item, drag)}
    </DragWrap>
  );

  // Réordonnancement parmi les actifs : on réécrit uniquement les positions
  // actives du tableau source, les barrés ne bougent jamais de leurs cases.
  const onReorder = ({ from, to }) => {
    if (from === to) return;
    setItems(prev => {
      const slots = prev.map((it, i) => (it && !it.crossed ? i : -1)).filter(i => i >= 0);
      if (from < 0 || to < 0 || from >= slots.length || to >= slots.length) return prev;
      const seq = slots.map(i => prev[i]);
      const [moved] = seq.splice(from, 1);
      seq.splice(to, 0, moved);
      const next = prev.slice();
      slots.forEach((pos, k) => { next[pos] = seq[k]; });
      return next;
    });
  };

  // Articles envoyés vers l'optimiseur : JAMAIS les articles barrés.
  // Priorité aux articles cochés ; sinon tous les non-barrés. Un seul critère,
  // visible dans le libellé du bouton (fini le fallback caché « tout envoyer »).
  const selectableItems = items.filter(it => it && !it.crossed);
  const selectedForSend = selectableItems.filter(it => it.selected || it.checked);
  // Plus de repli silencieux vers « tout envoyer » : on n'envoie QUE ce qui est
  // coché, et le bouton n'apparaît que dans ce cas (demande user).
  const itemsToSend = selectedForSend;

  const Header = (
    <View style={lstyles.header}>
      <View style={lstyles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={lstyles.title} numberOfLines={1}>{readOnly ? (activeShared.owner?.name || t('tabs.myList')) : t('tabs.myList')}</Text>
          <Text style={lstyles.subtitle} numberOfLines={1}>{readOnly ? (t('listScreen.readOnlyShared', 'Liste partagée · lecture seule')) : t('counts.listSelected', { count: items.filter(it => it && it.selected && !it.crossed).length })}</Text>
        </View>
        {!readOnly && (
          <TouchableOpacity onPress={ouvrirPartage} activeOpacity={0.8} style={lstyles.scanBtn}>
            <Ionicons name="share-social-outline" size={17} color={THEME.brandDark} />
            <Text style={lstyles.scanTxt}>{t('listScreen.share', 'Partager')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={async () => { await openCamera(); }} activeOpacity={0.8} style={lstyles.scanBtn}>
          <Ionicons name="scan-outline" size={17} color={THEME.brandDark} />
          <Text style={lstyles.scanTxt}>{t('listScreen.scan')}</Text>
        </TouchableOpacity>
      </View>

      {/* Nom de liste à gauche, badge de partage aligné à DROITE sur la même ligne. */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
        <TouchableOpacity onPress={() => setSwitcherOpen(true)} activeOpacity={0.8}
          style={{ flexDirection:'row', alignItems:'center', backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, borderRadius:TAILLES.boutonPetit / 2, paddingHorizontal:12, height:TAILLES.boutonPetit, flexShrink:1 }}>
          <Ionicons name="swap-horizontal" size={16} color={THEME.brandDark} />
          <Text style={{ marginHorizontal:8, fontWeight:'700', color:THEME.ink, maxWidth:190 }} numberOfLines={1}>
            {readOnly ? (activeShared.owner?.name || t('tabs.myList')) : activeListName}
          </Text>
          <Ionicons name="chevron-down" size={15} color={THEME.faint} />
        </TouchableOpacity>

        {/* Ma liste est partagée : icône + nombre. Un appui montre qui y a accès. */}
        {!readOnly && (granted.accepted.length > 0 || granted.pending.length > 0) && (
          <TouchableOpacity onPress={() => setGrantedOpen(true)} activeOpacity={0.8}
            style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:THEME.terraSoft, borderRadius:TAILLES.boutonPetit / 2, paddingHorizontal:12, height:TAILLES.boutonPetit, marginLeft:10 }}>
            <Ionicons name="people" size={15} color={THEME.terraDark} />
            <Text style={{ marginLeft:6, fontWeight:'800', color:THEME.terraDark, fontSize:12.5 }}>
              {granted.accepted.length}
              {granted.pending.length > 0 ? ` (+${granted.pending.length})` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!readOnly && (<>
      <View style={lstyles.inputWrap}>
        <TextInput
          autoCorrect={true}
          spellCheck={true}
          autoCapitalize="sentences"
          keyboardType="default"
          textContentType="none"
          secureTextEntry={false}
          value={text}
          onChangeText={setText}
          placeholder={t('listScreen.inputPlaceholder')}
          placeholderTextColor={THEME.faint}
          numberOfLines={1}
          style={lstyles.input}
          returnKeyType="done"
          onSubmitEditing={addFromInput}
        />
        <TouchableOpacity onPress={addFromInput} activeOpacity={0.85} style={lstyles.addBtn}>
          <Ionicons name="add" size={26} color="#1C1917" />
        </TouchableOpacity>
      </View>

      <View style={lstyles.toolRow}>
        <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.8} style={[lstyles.pill, selectAll && lstyles.pillOn]}>
          <Text style={[lstyles.pillTxt, selectAll && lstyles.pillTxtOn]}>{t('listScreen.selectAll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleStrikeAll} activeOpacity={0.8} style={[lstyles.pill, strikeAll && lstyles.pillOnDark]}>
          <Text style={[lstyles.pillTxt, strikeAll && lstyles.pillTxtOn]}>{t('listScreen.strikeAll')}</Text>
        </TouchableOpacity>
        {items.some(it => it.selected) && (
          <TouchableOpacity onPress={() => {
            const count = items.filter(it => it.selected).length;
            Alert.alert(t('listScreen.deleteTitle'), `${t('listScreen.deleteConfirm')} ${t('counts.listSelected', { count })}`, [
              { text: t('listScreen.cancel'), style: 'cancel' },
              { text: t('listScreen.delete'), style: 'destructive', onPress: () => {
                setItems(prev => prev.filter(it => !it.selected));
                setSelectAll(false);
              }}
            ]);
          }} activeOpacity={0.8} style={lstyles.delPill}>
            <Ionicons name="trash-outline" size={15} color={THEME.danger} />
            <Text style={lstyles.delTxt}>{items.filter(it => it.selected).length}</Text>
          </TouchableOpacity>
        )}
      </View>
      </>)}
    </View>
  );

  return (
    <View style={lstyles.screen}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={lstyles.screen} edges={['top']}>
      <ReorderableList
        data={activeItems}
        onReorder={onReorder}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          crossedItems.length === 0 ? (
            <View style={lstyles.empty}>
              <Text style={lstyles.emptyTitle}>{t('listScreen.noItems')}</Text>
              <Text style={lstyles.emptyHint}>{t('listScreen.inputPlaceholder')}</Text>
            </View>
          ) : null
        }
        // Les articles barrés vivent hors de la zone déplaçable : toujours en
        // bas, jamais déplaçables, donc jamais de conflit avec le drag.
        ListFooterComponent={
          crossedItems.length ? (
            <View>{crossedItems.map(it => (
              <View key={it.id}>{renderRow(it, undefined)}</View>
            ))}</View>
          ) : null
        }
        contentContainerStyle={(activeItems.length === 0 && crossedItems.length === 0) ? { flexGrow: 1, paddingBottom: 180 } : { paddingBottom: 180 }}
      />

      {!readOnly && (
      <View style={lstyles.bottomWrap}>
        {/* Toute la ligne bascule l'option : le Switch seul offrait une cible
            minuscule et restait insensible au toucher. */}
        <Pressable
          onPress={() => setHideCrossed(v => !v)}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
          style={lstyles.hideRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: hideCrossed }}
          accessibilityLabel={t('listScreen.hideStriked')}
        >
          <Switch
            value={hideCrossed}
            onValueChange={setHideCrossed}
            pointerEvents="none"
            trackColor={{ true: THEME.terra, false: THEME.borderInput }}
            thumbColor="#fff"
            style={{ transform:[{ scale:0.85 }] }}
          />
          <Text style={lstyles.hideTxt}>{t('listScreen.hideStriked')}</Text>
        </Pressable>
        {itemsToSend.length > 0 && (
        <TouchableOpacity activeOpacity={0.9} style={lstyles.cta}
        accessibilityRole="button" accessibilityLabel={t('listScreen.findExactProducts')} onPress={async ()=>{
        try{
          // Un seul critère : les articles à envoyer (non barrés), jamais les barrés.
          const chosen = itemsToSend.map(it=>({
            name: String(it.name||it.title||'').trim(),
            qty: Number(it.qty||it.quantity||1),
            // Article venu de Menus : noms français équivalents pour la correspondance
            // (valables tant que le nom n'a pas été modifié).
            ...((Array.isArray(it.matchNames) && it.matchNames.length && it.matchFor === it.name) ? { matchNames: it.matchNames, matchFor: it.name } : {}),
            // Liste d'origine : l'ajout au panier raye dans CETTE liste, même si
            // une autre est devenue active entre-temps (sans listId : l'active).
            listId: activeListId,
          })).filter(it=>it.name);
          await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify(chosen));
        }catch(e){}
        DeviceEventEmitter.emit('PRODUCTS_RESET');
        navigation.navigate("products");
      }}>
          <Ionicons name="bag-check-outline" size={20} color="#1C1917" />
          <Text style={lstyles.ctaTxt}>{t('listScreen.findExactProducts')} ({itemsToSend.length})</Text>
        </TouchableOpacity>
        )}
      </View>
      )}

      {/* Switcher : Mes listes (+ créer) / listes partagées avec moi */}
      <Modal visible={switcherOpen} transparent animationType="fade" onRequestClose={() => setSwitcherOpen(false)}>
        <Pressable style={lstyles.modalBackdrop} onPress={() => setSwitcherOpen(false)}>
          <Pressable style={lstyles.modalBox} onPress={() => {}}>
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:14 }}>
              <Text style={[lstyles.modalTitle, { flex:1, marginBottom:0 }]}>{t('listScreen.chooseList', 'Choisir une liste')}</Text>
              <TouchableOpacity onPress={() => setSwitcherOpen(false)} activeOpacity={0.7}
                hitSlop={{ top:10, bottom:10, left:10, right:10 }}
                style={{ width:TAILLES.icone, height:TAILLES.icone, borderRadius:TAILLES.icone / 2, backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, alignItems:'center', justifyContent:'center', marginLeft:10 }}>
                <Ionicons name="close" size={18} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {/* --- Mes listes --- */}
              <Text style={{ fontSize:12, fontWeight:'700', color:THEME.terraDark, textTransform:'uppercase', letterSpacing:1, marginTop:4, marginBottom:2 }}>{t('listScreen.myLists', 'Mes listes')}</Text>
              {myLists.map((l) => {
                const isActive = !readOnly && activeListId === l.id;
                return (
                  <View key={l.id} style={{ flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:THEME.border }}>
                    <TouchableOpacity onPress={() => switchOwnList(l.id)} activeOpacity={0.8}
                      style={{ flexDirection:'row', alignItems:'center', paddingVertical:14, flex:1 }}>
                      <Ionicons name="list" size={20} color={THEME.brandDark} />
                      <Text style={{ marginLeft:12, fontWeight: isActive ? '800' : '600', color:THEME.ink, flex:1 }} numberOfLines={1}>{l.name || t('tabs.myList')}</Text>
                      {isActive && <Ionicons name="checkmark" size={18} color={THEME.terra} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => renameList(l)} activeOpacity={0.7} style={{ paddingHorizontal:8, paddingVertical:14 }}>
                      <Ionicons name="create-outline" size={18} color={THEME.muted} />
                    </TouchableOpacity>
                    {l.id !== DEFAULT_LIST_ID && (
                      <TouchableOpacity onPress={() => deleteList(l.id)} activeOpacity={0.7} style={{ paddingHorizontal:8, paddingVertical:14 }}>
                        <Ionicons name="trash-outline" size={18} color={THEME.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity onPress={createList} activeOpacity={0.8}
                style={{ flexDirection:'row', alignItems:'center', paddingVertical:14 }}>
                <Ionicons name="add-circle-outline" size={20} color={THEME.brand} />
                <Text style={{ marginLeft:12, fontWeight:'700', color:THEME.brand, flex:1 }}>{t('listScreen.createList', 'Créer une liste')}</Text>
              </TouchableOpacity>

              {/* --- Partagées avec moi --- */}
              {sharedLists.length > 0 && (
                <>
                  <Text style={{ fontSize:12, fontWeight:'700', color:THEME.terraDark, textTransform:'uppercase', letterSpacing:1, marginTop:14, marginBottom:2 }}>{t('listScreen.sharedWithMe', 'Partagées avec moi')}</Text>
                  {sharedLists.map((l) => (
                    <TouchableOpacity key={String(l.share_id)} onPress={() => { setViewingShareId(l.share_id); setSwitcherOpen(false); }} activeOpacity={0.8}
                      style={{ flexDirection:'row', alignItems:'center', paddingVertical:14, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                      <Ionicons name="people-outline" size={20} color={THEME.brandDark} />
                      <Text style={{ marginLeft:12, fontWeight:'600', color:THEME.ink, flex:1 }} numberOfLines={1}>{l.owner?.name || '-'}</Text>
                      {String(viewingShareId) === String(l.share_id) && <Ionicons name="checkmark" size={18} color={THEME.terra} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Qui a accès à MA liste */}
      <Modal visible={grantedOpen} transparent animationType="fade" onRequestClose={() => { if (profilPartage) setProfilPartage(null); else setGrantedOpen(false); }} onDismiss={() => setProfilPartage(null)}>
        <View style={lstyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setProfilPartage(null); setGrantedOpen(false); }} />
          {profilPartage ? (() => {
            const pu = profilPartage.user || {};
            const nom = pu.display_name || pu.name || pu.username;
            return (
              <View style={[lstyles.modalBox, { alignItems:'center' }]}>
                <View style={{ alignSelf:'stretch', flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                  <TouchableOpacity onPress={() => setProfilPartage(null)} activeOpacity={0.7}
                    hitSlop={{ top:10, bottom:10, left:10, right:10 }}
                    style={{ width:TAILLES.icone, height:TAILLES.icone, borderRadius:TAILLES.icone / 2, backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, alignItems:'center', justifyContent:'center' }}>
                    <Ionicons name="chevron-back" size={18} color={THEME.muted} />
                  </TouchableOpacity>
                  <View style={{ flex:1 }} />
                  <TouchableOpacity onPress={() => { setProfilPartage(null); setGrantedOpen(false); }} activeOpacity={0.7}
                    hitSlop={{ top:10, bottom:10, left:10, right:10 }}
                    style={{ width:TAILLES.icone, height:TAILLES.icone, borderRadius:TAILLES.icone / 2, backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, alignItems:'center', justifyContent:'center' }}>
                    <Ionicons name="close" size={18} color={THEME.muted} />
                  </TouchableOpacity>
                </View>
                {pu.profileImage
                  ? <Image source={{ uri: pu.profileImage }} style={{ width:84, height:84, borderRadius:42, backgroundColor:THEME.subtle }} />
                  : <View style={{ width:84, height:84, borderRadius:42, alignItems:'center', justifyContent:'center', backgroundColor:THEME.brandSoft }}>
                      <Ionicons name="person" size={38} color={THEME.brandDark} />
                    </View>}
                <Text style={{ fontSize:18, fontWeight:'800', color:THEME.ink, marginTop:12 }} numberOfLines={1}>{nom}</Text>
                <Text style={{ fontSize:13.5, color:THEME.faint, marginTop:2 }} numberOfLines={1}>@{pu.username}</Text>
                {profilPartage.loading ? (
                  <ActivityIndicator style={{ marginTop:16 }} color={THEME.brand} />
                ) : (
                  <>
                    {(pu.followers_count != null || pu.following_count != null) && (
                      <View style={{ flexDirection:'row', marginTop:16 }}>
                        <View style={{ alignItems:'center', marginHorizontal:18 }}>
                          <Text style={{ fontSize:16, fontWeight:'800', color:THEME.ink }}>{pu.followers_count ?? 0}</Text>
                          <Text style={{ fontSize:12.5, color:THEME.faint }}>{t('listScreen.profileFollowers', 'Abonnés')}</Text>
                        </View>
                        <View style={{ alignItems:'center', marginHorizontal:18 }}>
                          <Text style={{ fontSize:16, fontWeight:'800', color:THEME.ink }}>{pu.following_count ?? 0}</Text>
                          <Text style={{ fontSize:12.5, color:THEME.faint }}>{t('listScreen.profileFollowing', 'Abonnements')}</Text>
                        </View>
                      </View>
                    )}
                    {!!(pu.bio && String(pu.bio).trim()) && (
                      <Text style={{ fontSize:13.5, color:THEME.muted, textAlign:'center', marginTop:14 }} numberOfLines={4}>{String(pu.bio).trim()}</Text>
                    )}
                  </>
                )}
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://pearlstreets.com/user-profile/share-profile-link?userName=${encodeURIComponent(pu.username || '')}`).catch(() => {})}
                  activeOpacity={0.8}
                  style={{ alignSelf:'stretch', marginTop:20, height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.borderInput, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:14 }}>{t('listScreen.profileOpenFull', 'Voir le profil sur Pearl Streets')}</Text>
                </TouchableOpacity>
              </View>
            );
          })() : (
          <View style={lstyles.modalBox}>
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:14 }}>
              <Text style={[lstyles.modalTitle, { flex:1, marginBottom:0 }]}>{t('listScreen.grantedTitle', 'Qui a accès à ma liste')}</Text>
              <TouchableOpacity onPress={() => setGrantedOpen(false)} activeOpacity={0.7}
                hitSlop={{ top:10, bottom:10, left:10, right:10 }}
                style={{ width:TAILLES.icone, height:TAILLES.icone, borderRadius:TAILLES.icone / 2, backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, alignItems:'center', justifyContent:'center', marginLeft:10 }}>
                <Ionicons name="close" size={18} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {granted.accepted.length === 0 && granted.pending.length === 0 && (
                <Text style={{ color:THEME.faint, paddingVertical:12 }}>{t('listScreen.grantedNobody', 'Personne pour le moment.')}</Text>
              )}
              {granted.accepted.map((g) => (
                <View key={`a-${g.share_id}`} style={{ flexDirection:'row', alignItems:'center', paddingVertical:11, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                  <TouchableOpacity onPress={() => ouvrirProfilPartage(g.user)} activeOpacity={0.7} style={{ flex:1, flexDirection:'row', alignItems:'center' }}>
                  {g.user?.profileImage
                    ? <Image source={{ uri: g.user.profileImage }} style={lstyles.suggestAvatar} />
                    : <View style={[lstyles.suggestAvatar, { alignItems:'center', justifyContent:'center', backgroundColor:THEME.brandSoft }]}>
                        <Ionicons name="person" size={16} color={THEME.brandDark} />
                      </View>}
                  <View style={{ flex:1, marginLeft:10 }}>
                    <Text style={{ fontSize:14, fontWeight:'700', color:THEME.ink }} numberOfLines={1}>{g.user?.name || g.user?.username}</Text>
                    <Text style={{ fontSize:12.5, color:THEME.faint }} numberOfLines={1}>@{g.user?.username}</Text>
                  </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try { await revokeShare(g.user?.username); } catch {}
                      try {
                        const r = await getGrantedShares();
                        if (r && r.status && r.data) setGranted({ accepted: r.data.accepted || [], pending: r.data.pending || [], count: r.data.count || 0 });
                      } catch {}
                    }}
                    activeOpacity={0.7} style={{ paddingHorizontal:8, paddingVertical:6 }}>
                    <Text style={{ color:THEME.danger, fontWeight:'700', fontSize:12.5 }}>{t('listScreen.revoke', 'Retirer')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {granted.pending.length > 0 && (
                <Text style={{ fontSize:12, fontWeight:'700', color:THEME.terraDark, textTransform:'uppercase', letterSpacing:1, marginTop:14, marginBottom:2 }}>
                  {t('listScreen.grantedPending', 'En attente de réponse')}
                </Text>
              )}
              {granted.pending.map((g) => (
                <View key={`p-${g.share_id}`} style={{ flexDirection:'row', alignItems:'center', paddingVertical:11 }}>
                  <TouchableOpacity onPress={() => ouvrirProfilPartage(g.user)} activeOpacity={0.7} style={{ flex:1, flexDirection:'row', alignItems:'center' }}>
                  <Ionicons name="time-outline" size={18} color={THEME.faint} />
                  <Text style={{ flex:1, marginLeft:10, fontSize:14, color:THEME.muted }} numberOfLines={1}>@{g.user?.username}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try { await revokeShare(g.user?.username); } catch {}
                      try {
                        const r = await getGrantedShares();
                        if (r && r.status && r.data) setGranted({ accepted: r.data.accepted || [], pending: r.data.pending || [], count: r.data.count || 0 });
                      } catch {}
                    }}
                    activeOpacity={0.7} style={{ paddingHorizontal:8, paddingVertical:6 }}>
                    <Text style={{ color:THEME.danger, fontWeight:'700', fontSize:12.5 }}>{t('listScreen.revoke', 'Retirer')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => { setGrantedOpen(false); setTimeout(ouvrirPartage, 350); }}
              activeOpacity={0.8}
              style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:14, height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.borderInput }}>
              <Ionicons name="person-add-outline" size={17} color={THEME.ink} />
              <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:14, marginLeft:8 }}>{t('listScreen.grantedAdd', 'Ajouter une personne')}</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>
      </Modal>

      {/* Créer une liste (modale custom cross-platform) */}
      <Modal visible={createListOpen} transparent animationType="fade" onRequestClose={() => setCreateListOpen(false)}
        onShow={() => setTimeout(() => createInputRef.current?.focus(), 80)}>
        <KeyboardAvoidingView behavior="padding" style={lstyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateListOpen(false)} />
          <View style={lstyles.modalBox}>
            <Text style={lstyles.modalTitle}>{t('listScreen.newListTitle', 'Nouvelle liste')}</Text>
            <TextInput
              ref={createInputRef}
              key={createListOpen ? 'cl-open' : 'cl-closed'}
              defaultValue=""
              onChangeText={setNewListName}
              placeholder={t('listScreen.newListPrompt', 'Nom de la liste')}
              placeholderTextColor={THEME.faint}
              returnKeyType="done"
              onSubmitEditing={confirmCreateList}
              style={[lstyles.input, { flex: 0 }]}
            />
            <View style={lstyles.modalRow}>
              <TouchableOpacity onPress={() => setCreateListOpen(false)} activeOpacity={0.8} style={lstyles.modalCancel}>
                <Text style={lstyles.modalCancelTxt}>{t('listScreen.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmCreateList} activeOpacity={0.85} disabled={!newListName.trim()}
                style={[lstyles.modalSave, { opacity: newListName.trim() ? 1 : 0.5 }]}>
                <Text style={lstyles.modalSaveTxt}>{t('listScreen.create', 'Créer')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Renommer une liste */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}
        onShow={() => setTimeout(() => renameInputRef.current?.focus(), 80)}>
        <View style={lstyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameOpen(false)} />
          <View style={lstyles.modalBox}>
            <Text style={lstyles.modalTitle}>{t('listScreen.renameListTitle', 'Renommer la liste')}</Text>
            {renameOpen ? (
              <TextInput
                ref={renameInputRef}
                defaultValue={renameName}
                onChangeText={setRenameName}
                placeholder={t('listScreen.newListPrompt', 'Nom de la liste')}
                placeholderTextColor={THEME.faint}
                returnKeyType="done"
                onSubmitEditing={confirmRenameList}
                style={[lstyles.input, { flex: 0 }]}
              />
            ) : null}
            <View style={lstyles.modalRow}>
              <TouchableOpacity onPress={() => setRenameOpen(false)} activeOpacity={0.8} style={lstyles.modalCancel}>
                <Text style={lstyles.modalCancelTxt}>{t('listScreen.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmRenameList} activeOpacity={0.85} disabled={!renameName.trim()}
                style={[lstyles.modalSave, { opacity: renameName.trim() ? 1 : 0.5 }]}>
                <Text style={lstyles.modalSaveTxt}>{t('listScreen.save', 'Enregistrer')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Partager ma liste */}
      <Modal visible={shareModalOpen} transparent animationType="fade" onRequestClose={() => setShareModalOpen(false)}
        onShow={() => setTimeout(() => shareInputRef.current?.focus(), 80)}>
        <View style={lstyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModalOpen(false)} />
          <View style={lstyles.modalBox}>
            <Text style={lstyles.modalTitle}>{t('listScreen.shareTitle', 'Partager ma liste')}</Text>
            <Text style={{ color:THEME.faint, marginBottom:12 }}>{t('listScreen.shareHint', 'Email ou pseudo de la personne. Elle recevra une demande à accepter.')}</Text>
            {!isLoggedIn && (
              <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:THEME.brandSoft, borderRadius:12, padding:10, marginBottom:10 }}>
                <Ionicons name="information-circle-outline" size={18} color={THEME.brandDark} style={{ marginRight:8 }} />
                <Text style={{ flex:1, fontSize:12.5, color:THEME.brandDark, fontWeight:'600' }}>
                  {t('listScreen.shareNeedsLogin', 'Connectez-vous pour pouvoir envoyer une demande de partage.')}
                </Text>
              </View>
            )}
            {shareModalOpen ? (
            <TextInput
              ref={shareInputRef}
              key={`share-${shareInputKey}`}
              defaultValue={shareInput}
              onChangeText={onShareInputChange}
              placeholder={t('listScreen.sharePlaceholder', 'email ou pseudo')}
              placeholderTextColor={THEME.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={submitShareRequest}
              style={[lstyles.input, { flex: 0 }]}
            />
            ) : null}
            {isLoggedIn && shareSuggestions.length > 0 && (
              <View style={lstyles.suggestBox}>
                {shareSuggestions.map((u, i) => (
                  <TouchableOpacity key={String(u.id ?? i)} onPress={() => pickShareUser(u)} activeOpacity={0.7}
                    style={[lstyles.suggestRow, i < shareSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: THEME.border }]}>
                    {u.profileImage
                      ? <Image source={{ uri: u.profileImage }} style={lstyles.suggestAvatar} />
                      : <View style={[lstyles.suggestAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.brandSoft }]}>
                          <Ionicons name="person" size={16} color={THEME.brandDark} />
                        </View>}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.ink }} numberOfLines={1}>{u.display_name || u.firstName || u.username}</Text>
                      <Text style={{ fontSize: 12.5, color: THEME.faint }} numberOfLines={1}>@{u.username}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={THEME.brand} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity activeOpacity={0.9} disabled={shareBusy}
              style={[lstyles.cta, { marginTop:14 }, shareBusy && { opacity:0.5 }]}
              onPress={submitShareRequest}>
              <Ionicons name="paper-plane-outline" size={18} color="#1C1917" />
              <Text style={lstyles.ctaTxt}>{t('listScreen.sendRequest', 'Envoyer la demande')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Unit picker modal */}
      <Modal visible={unitPickerId !== null} transparent animationType="fade" onRequestClose={() => setUnitPickerId(null)}>
        <Pressable style={lstyles.modalBackdrop} onPress={() => setUnitPickerId(null)}>
          <Pressable style={lstyles.modalBox} onPress={() => {}}>
            <Text style={lstyles.modalTitle}>{t('listScreen.unit')}</Text>
            <View style={lstyles.unitGrid}>
              {['u','g','kg','mL','cL','L','mg'].map((u) => {
                const current = items.find(i => i.id === unitPickerId)?.unit || 'u';
                const active = current === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => { setUnit(unitPickerId, u); setUnitPickerId(null); }}
                    style={[lstyles.unitOpt, active && lstyles.unitOptOn]}
                  >
                    <Text style={[lstyles.unitOptTxt, active && lstyles.unitOptTxtOn]}>{u === 'u' ? t('listScreen.unitPiece', 'u') : u}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[lstyles.modalRow, { marginTop: 14 }]}>
              <Pressable onPress={() => setUnitPickerId(null)} style={[lstyles.modalCancel, { flex: 1, marginRight: 0 }]}>
                <Text style={lstyles.modalCancelTxt}>{t('listScreen.cancel')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={closeEdit}
        onShow={() => setTimeout(() => editInputRef.current?.focus(), 80)}>
        <KeyboardAvoidingView behavior="padding" style={lstyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEdit} />
          <View style={lstyles.modalBox}>
            <Text style={lstyles.modalTitle}>{t('listScreen.editItem')}</Text>
            {editVisible ? (
            <TextInput
              ref={editInputRef}
              defaultValue={editText}
              onChangeText={setEditText}
              style={lstyles.modalInput}
              autoCorrect={true}
              spellCheck={true}
              autoCapitalize="sentences"
              keyboardType="default"
              textContentType="none"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />
            ) : null}
            <View style={lstyles.modalRow}>
              <Pressable onPress={closeEdit} style={lstyles.modalCancel}>
                <Text style={lstyles.modalCancelTxt}>{t('listScreen.cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={lstyles.modalSave}>
                <Text style={lstyles.modalSaveTxt}>{t('listScreen.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
    </View>
  );
}











function MainNavigator({ onLogout, isAuth }) {
  const { t } = useTranslation();

  // Compteur du panier pour le badge de l'onglet Panier (source : KEY_CART).
  const [cartCount, setCartCount] = React.useState(0);
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_CART);
        const arr = raw ? JSON.parse(raw) : [];
        const n = Array.isArray(arr) ? arr.reduce((s, it) => s + Number(it.qty || 1), 0) : 0;
        if (mounted) setCartCount(n);
      } catch (e) { if (mounted) setCartCount(0); }
    };
    load();
    // CART_UPDATED = ajout externe (recharge aussi l'écran Panier) ; CART_COUNT_CHANGED
    // = mutation interne au Panier (badge seul, ne recharge PAS l'écran pour préserver
    // la sélection de l'utilisateur). Le badge écoute les deux.
    const sub = DeviceEventEmitter.addListener('CART_UPDATED', load);
    const sub2 = DeviceEventEmitter.addListener('CART_COUNT_CHANGED', load);
    return () => { mounted = false; sub.remove(); sub2.remove(); };
  }, []);

  const ICONS = {
    "profile": { focused: "person", unfocused: "person-outline" },
    "myList": { focused: "reorder-three", unfocused: "reorder-three-outline" },
    // Optimiseur = comparaison de prix (icône distincte du Panier)
    "menus": { focused: "restaurant", unfocused: "restaurant-outline" },
    "products": { focused: "pricetags",      unfocused: "pricetags-outline" },
    "shops": { focused: "storefront",      unfocused: "storefront-outline" },
    "cart":   { focused: "bag-handle",     unfocused: "bag-handle-outline" }
  };

  const getTabName = (key) => {
    const tabNames = {
      myList: t('tabs.myList'),
      menus: t('tabs.menus'),
      products: t('tabs.products'),
      shops: t('tabs.shops', 'Boutiques'),
      cart: t('tabs.cart'),
      profile: t('tabs.profile')
    };
    return tabNames[key] || key;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleAlign: "center",
        headerTitle: getTabName(route.name),
        tabBarLabel: ({ color, position }) => <TabLabel label={getTabName(route.name)} color={color} position={position} />,
        tabBarActiveTintColor: THEME.ink,
        tabBarInactiveTintColor: THEME.faint,
        tabBarStyle: { height: 88, paddingTop: 8, paddingBottom: 28, backgroundColor: THEME.bg, borderTopColor: THEME.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name] || { focused:"ellipse", unfocused:"ellipse-outline" };
          const name = focused ? iconSet.focused : iconSet.unfocused;
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="myList" component={ListScreen} options={{ headerShown: false }} />
      <Tab.Screen name="menus" component={MenusScreen} options={{ headerShown: false }} />
      <Tab.Screen name="products" component={ProductsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="shops" component={ShopsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="cart" options={{ headerShown: false, tabBarBadge: cartCount > 0 ? cartCount : undefined, tabBarBadgeStyle: { top: -5, end: -8 } }}>{() => <CartScreen isAuth={isAuth} />}</Tab.Screen>
      <Tab.Screen name="profile" options={{ headerShown: false }}>{() => <FakeProfileScreen onLogout={onLogout} isAuth={isAuth} />}</Tab.Screen>
    </Tab.Navigator>
  );
}









// Ecran exterieur de l'iPhone Duo (camera et heure sur le cote) : marges gauche et droite
// appliquees une seule fois ici, puis remises a zero pour les ecrans en dessous.
// Sans marge laterale (tous les autres telephones), rien ne change.
function MargesCotes({ children }) {
  const insets = useSafeAreaInsets();
  if (!insets.left && !insets.right) return children;
  return (
    <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: THEME.bg }}>
      <SafeAreaInsetsContext.Provider value={{ ...insets, left: 0, right: 0 }}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}

export default function App() {
  const { i18n: i18nApp } = useTranslation();
  const [isAuth, setIsAuth] = React.useState(null); // null = loading, true/false
  const [needLangChoice, setNeedLangChoice] = React.useState(null); // null = loading, true = 1er lancement
  const [proBlocked, setProBlocked] = React.useState(false);
  const [authVisible, setAuthVisible] = React.useState(false);
  const [authSignup, setAuthSignup] = React.useState(false);
  const authRetour = React.useRef(null);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_AUTH', (params) => {
      oublierModeAuth();
      setAuthSignup(params && params.signup === true);
      setAuthVisible(true);
    });
    return () => sub.remove();
  }, []);

  // Check if pro user needs verification
  React.useEffect(() => {
    (async () => {
      await purgerSessionSiNonConservee();
      const authRaw = await getSecureItem(KEY_AUTH);
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        if (auth.role === 'professionaluser' && !auth.isVerified) {
          setProBlocked(true);
        } else {
          setProBlocked(false);
        }
      }
    })();
  }, [isAuth]);

  const [currency, setCurrencyState] = React.useState(CURRENCIES[0]);
  const [liveRates, setLiveRates] = React.useState(null);

  // Fetch live exchange rates on mount and every 30 min
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const rates = await fetchLiveRates();
      if (mounted && rates) setLiveRates(rates);
    };
    load();
    const interval = setInterval(load, RATES_CACHE_MS);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // When liveRates arrive, update current currency rate
  React.useEffect(() => {
    if (liveRates && currency.code !== 'EUR') {
      const live = liveRates[currency.code];
      if (live && isFinite(live) && live !== currency.rate) {
        setCurrencyState(prev => ({ ...prev, rate: live }));
      }
    }
  }, [liveRates]);

  const fmtPrice = React.useCallback((eurAmount) => {
    const n = Number(eurAmount || 0) * currency.rate;
    const dec = currency.decimals !== undefined ? currency.decimals : 2;
    let formatted = n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // Francais : virgule decimale (12,50 EUR).
    if ((i18nApp.language || '').startsWith('fr')) formatted = formatted.replace('.', ',');
    return `${formatted} ${currency.symbol}`;
  }, [currency, i18nApp.language]);

  const setCurrency = React.useCallback(async (cur) => {
    // Apply live rate if available
    const updated = getCurrencyWithLiveRate(cur, liveRates || getCachedLiveRates());
    setCurrencyState(updated);
    await AsyncStorage.setItem('APP_CURRENCY', cur.code);
  }, [liveRates]);

  React.useEffect(() => onMenuReminderOpen(ouvrirMenusDepuisRappel), []);

  // Notifications de commande (services/pushDirect.js) : autorisation demandée
  // une fois au premier passage connecté, puis téléphone enregistré. Une
  // notification touchée avant la fin du chargement s'ouvre ici. Déconnexion :
  // la destination en attente n'est plus pour ce compte.
  const etaitConnecte = React.useRef(false);
  React.useEffect(() => {
    definirConnexion(isAuth === true);
    if (isAuth === true) {
      demanderPermission()
        .then(() => enregistrerAppareil())
        .catch(() => {});
      consommerDestination();
    } else if (isAuth === false && etaitConnecte.current) {
      oublierDestination();
    }
    etaitConnecte.current = isAuth === true;
    if (isAuth !== true) return undefined;
    // Retour au premier plan (autorisation accordée dans les réglages, envoi
    // précédent échoué, ligne révoquée par le serveur) : nouvel enregistrement.
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      enregistrerAppareil();
      consommerDestination();
    });
    // Langue changée : le serveur l'apprend (titres des notifications).
    const surLangue = () => { enregistrerAppareil(); };
    i18nApp.on('languageChanged', surLangue);
    return () => { sub.remove(); i18nApp.off('languageChanged', surLangue); };
  }, [isAuth]);

  // Mises à jour OTA appliquées dès ce lancement quand c'est rapide (voir services/otaRapide.js).
  React.useEffect(() => demarrerOtaRapide(AppState), []);

  React.useEffect(() => {
    (async () => {
      await purgerSessionSiNonConservee();
      await purgeLegacyLocalAccounts();
      startMenusSync(AppState);
      startMenuReminders(AppState, i18nApp);
      const raw = await getSecureItem(KEY_AUTH);
      // 1er lancement = aucune langue enregistrée → on présentera le choix de langue.
      const savedLang = await AsyncStorage.getItem('APP_LANGUAGE');
      setNeedLangChoice(!savedLang);
      // Restaure la devise choisie AVANT de lever l'écran de chargement (setIsAuth) :
      // sinon un utilisateur non-EUR voit une frame de prix en € (taux 1) au cold boot.
      const savedCur = await AsyncStorage.getItem('APP_CURRENCY');
      if (savedCur) {
        const found = CURRENCIES.find(c => c.code === savedCur);
        if (found) {
          const updated = getCurrencyWithLiveRate(found, getCachedLiveRates());
          setCurrencyState(updated);
        }
      }
      setIsAuth(!!raw);
    })();
  }, []);

  if (isAuth === null || needLangChoice === null) {
    return (
      <View style={{flex:1, backgroundColor:THEME.bg, alignItems:'center', justifyContent:'center'}}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  if (needLangChoice) {
    return <MargesCotes><AuMilieu><StatusBar style="dark" /><FirstLaunchLanguage onDone={() => setNeedLangChoice(false)} /></AuMilieu></MargesCotes>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <StatusBar style="dark" />
    <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
      <DeuxEcrans>
      <MargesCotes>
      <NavigationContainer ref={navRef} onReady={() => { ouvrirOngletApresRechargement(); ouvrirMenusDepuisRappel(); consommerDestination(); }} theme={navTheme}>
        <MainNavigator onLogout={() => setIsAuth(false)} isAuth={isAuth} />
      </NavigationContainer>
      </MargesCotes>
      <Modal visible={authVisible} animationType="slide" onRequestClose={() => {
        if (authRetour.current && authRetour.current()) return;
        oublierModeAuth(); setAuthVisible(false);
      }}>
        <AuthScreen
          key={authSignup ? 'signup' : 'login'}
          initialIsLogin={!authSignup}
          retourRef={authRetour}
          onLogin={() => { oublierModeAuth(); setIsAuth(true); setAuthVisible(false); }}
          onClose={() => { oublierModeAuth(); setAuthVisible(false); }}
        />
      </Modal>
      </DeuxEcrans>
    </CurrencyContext.Provider>
    </GestureHandlerRootView>
  );
}




const profStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },

  // Custom in-screen header
  header: { paddingHorizontal: TAILLES.marge, paddingTop: 10, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontFamily: SERIF, fontWeight: '400', color: THEME.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  // Profile identity card
  profileCard: { backgroundColor: THEME.card, borderRadius: 16, marginHorizontal: TAILLES.marge, marginTop: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  avatarWrap: { width: 60, height: 60, marginBottom: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#3B82F6', overflow: 'hidden' },
  avatarImg: { width: 60, height: 60 },
  avatarInitials: { fontSize: 24, fontWeight: '600', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: THEME.card, zIndex: 10 },
  profileName: { fontSize: 19, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.3, textAlign: 'center' },
  profileHandle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.borderInput, paddingHorizontal: 16, height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton, marginTop: 10 },
  editBtnTxt: { color: THEME.ink, fontWeight: '700', fontSize: 13, marginLeft: 6 },

  // Section
  section: { marginTop: 14, paddingHorizontal: TAILLES.marge },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12.5, fontWeight: '700', color: THEME.muted },

  // Verification banners
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 10 },
  bannerWarn: { backgroundColor: '#FEF3C7' },
  bannerOk: { backgroundColor: THEME.brandSoft },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 10, lineHeight: 18 },

  // Document status card
  docCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
  docDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  docIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  docStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  docStatusTxt: { fontSize: 11.5, fontWeight: '600' },

  // Order card
  orderCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  orderRow: { flexDirection: 'row', alignItems: 'center' },
  orderIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  orderBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  orderTitle: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  orderStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  orderDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  orderStatusTxt: { fontSize: 12.5, fontWeight: '700' },
  orderShops: { fontSize: 12.5, color: THEME.muted, marginTop: 3, fontWeight: '600' },
  orderDate: { fontSize: 11.5, color: THEME.faint, marginTop: 2, fontWeight: '600' },
  orderSide: { alignItems: 'flex-end' },
  modePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: THEME.subtle, marginBottom: 4 },
  modePillTxt: { fontSize: 10, fontWeight: '600', color: THEME.muted },
  orderPrice: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },

  // Settings rows
  settingsCard: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingVertical: 11, paddingHorizontal: 14 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  settingIcon: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  settingBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  settingValue: { fontSize: 12.5, color: THEME.muted, marginTop: 1, fontWeight: '600' },

  // Driver CTA card
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.border },
  driverIcon: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  driverBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  driverTitle: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  driverSub: { fontSize: 12.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  // Logout
  logoutBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoutTxt: { fontSize: 15.5, fontWeight: '600', color: THEME.danger, marginLeft: 8 },
  deleteAccountBtn: { height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deleteAccountTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.danger, marginLeft: 6, textDecorationLine: 'underline' },

  // Empty state
  empty: { backgroundColor: THEME.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  emptyCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // Guest screen
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center' },
  guestHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  guestBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 24, ...THEME.shadow },
  guestBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 16, marginLeft: 8 },
  // Guest hero (design soigné) + préférences accessibles sans connexion
  guestHero: { marginHorizontal: TAILLES.marge, marginVertical: 20, borderRadius: TAILLES.rayonCarte, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, paddingVertical: 26, paddingHorizontal: 24, alignItems: 'center', ...THEME.shadow },
  guestHeroIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  guestHeroTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center', letterSpacing: -0.3 },
  guestHeroHint: { fontSize: 13, color: THEME.muted, textAlign: 'center', marginTop: 8, lineHeight: 19, fontWeight: '600' },
  guestHeroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', backgroundColor: MARCHE.noir, borderWidth: 1, borderColor: MARCHE.noir, paddingHorizontal: 26, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, marginTop: 18 },
  guestHeroBtnTxt: { color: MARCHE.blanc, fontWeight: '600', fontSize: 15, marginLeft: 8 },
  guestHeroBtnAlt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.borderInput, paddingHorizontal: 26, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, marginTop: 10 },
  guestHeroBtnAltTxt: { color: THEME.ink, fontWeight: '600', fontSize: 15, marginLeft: 8 },
  guestPrefTitle: { fontSize: 12, fontWeight: '600', color: THEME.faint, marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Full-page modal header
  modalScreen: { flex: 1, backgroundColor: THEME.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  modalBack: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, flex: 1, letterSpacing: -0.4 },
  modalHeaderPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: THEME.terraSoft },
  modalHeaderPillTxt: { fontSize: 12, fontWeight: '600', color: THEME.terraDark },

  // Form fields
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: THEME.muted, marginBottom: 6 },
  field: { height: TAILLES.champ, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, paddingHorizontal: 14, fontSize: 15, color: THEME.ink, borderWidth: 1, borderColor: THEME.border },
  fieldGroup: { marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },

  // Generic white card inside modals
  modalCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },

  // Geolocation button
  geoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.borderInput, marginBottom: 20 },
  geoBtnTxt: { fontSize: 14.5, fontWeight: '700', color: THEME.ink, marginLeft: 8 },

  // Password change collapsible
  pwdToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 22, ...THEME.shadowSm },
  pwdToggleTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  pwdPanel: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 16, marginBottom: 22, ...THEME.shadowSm },
  pwdPanelHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pwdPanelTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: THEME.ink, marginLeft: 8 },
  pwdAlert: { borderRadius: 16, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  pwdAlertTxt: { fontSize: 12.5, fontWeight: '600', marginLeft: 6, flex: 1 },

  // Button row (cancel / save)
  btnRow: { flexDirection: 'row', gap: 12 },
  saveBtn: { flex: 1, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  saveBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 15 },

  // Primary full-width button
  primaryBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 16, marginLeft: 8 },

  // Picker rows (language / currency)
  pickerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, minHeight: 64, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  pickerRowOn: { backgroundColor: THEME.card, borderColor: MARCHE.noir },
  pickerFlag: { fontSize: 24, marginRight: 14 },
  pickerName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  pickerNameOn: { color: THEME.ink, fontWeight: '600' },
  pickerSub: { fontSize: 12, color: THEME.faint, marginTop: 2, fontWeight: '600' },

  // Sheet footer (confirm button area)
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },

  // Driver info modal hero
  driverHero: { alignItems: 'center', marginBottom: 22 },
  driverHeroIcon: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  driverHeroTitle: { fontSize: 22, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center', letterSpacing: -0.4 },
  driverHeroSub: { fontSize: 14, color: THEME.muted, marginTop: 6, textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  driverTypeCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  driverTypeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  driverTypeIcon: { width: 36, height: 36, borderRadius: 16, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverTypeTitle: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  driverTypeTxt: { fontSize: 13, color: THEME.muted, lineHeight: 20, fontWeight: '600' },
  limitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  limitFlag: { fontSize: 22, marginRight: 12 },
  limitName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  limitInfo: { fontSize: 11.5, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  limitValue: { fontSize: 13, fontWeight: '600' },
  legalNote: { fontSize: 11.5, color: THEME.faint, textAlign: 'center', marginTop: 10, lineHeight: 16, fontWeight: '600' },

  // Order detail rows
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailInfoLabel: { fontSize: 13, color: THEME.muted, marginLeft: 8, fontWeight: '600' },
  detailInfoValue: { fontSize: 13, fontWeight: '700', color: THEME.ink, marginLeft: 6 },
  driverChip: { backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  driverChipIcon: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverChipName: { fontSize: 13.5, fontWeight: '600', color: THEME.ink },
  driverChipSub: { fontSize: 12, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  driverChipCall: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  costBlock: { borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 12, marginTop: 4 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { fontSize: 13, color: THEME.muted, fontWeight: '600' },
  costValue: { fontSize: 13, fontWeight: '700', color: THEME.ink },
  costValueFree: { fontSize: 13, fontWeight: '700', color: THEME.terra },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 10, marginTop: 4 },
  grandLabel: { fontSize: 16, fontWeight: '600', color: THEME.ink },
  grandValue: { fontSize: 16, fontWeight: '600', color: THEME.ink },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 14, marginBottom: 12 },
  // Annulation par le client (sous le suivi de commande)
  cancelWrap: { marginTop: -4, marginBottom: 12 },
  cancelMsg: { fontSize: 13.5, lineHeight: 19, color: THEME.muted, fontWeight: '600', marginBottom: 8 },
  cancelBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.danger, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card },
  cancelBtnTxt: { color: THEME.danger, fontSize: 15, fontWeight: '600' },
  statusCardIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statusCardLabel: { fontSize: 12.5, color: THEME.muted, fontWeight: '600' },
  statusCardValue: { fontSize: 16, fontWeight: '600', marginTop: 1 },
  shopBlock: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  shopBlockHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  shopBlockIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  shopBlockName: { fontSize: 15, fontWeight: '600', color: THEME.ink },
  detailItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  detailItemDivider: { borderTopWidth: 1, borderTopColor: THEME.border },
  detailItemBody: { flex: 1, marginLeft: 10 },
  detailItemName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  detailItemMeta: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  detailItemPrice: { fontSize: 14, fontWeight: '600', color: THEME.ink },
  detailFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },

  // Reorder bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '78%', paddingBottom: Platform.OS === 'ios' ? 32 : 20, ...THEME.shadow, borderWidth: 1, borderColor: THEME.border },
  sheetGrabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  sheetTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.4 },
  selectAllPill: { paddingHorizontal: 14, height: TAILLES.icone, borderRadius: 999, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  selectAllTxt: { fontSize: 12, fontWeight: '700', color: THEME.ink },
  closeBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  reorderRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 16, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  reorderRowOn: { backgroundColor: THEME.card, borderColor: MARCHE.noir },
  reorderBody: { flex: 1, marginLeft: 10 },
  reorderName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  reorderShop: { fontSize: 11.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  reorderSide: { alignItems: 'flex-end' },
  reorderQty: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  reorderPrice: { fontSize: 13.5, fontWeight: '600', color: THEME.ink, marginTop: 2 },
  reorderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  reorderTotalLabel: { fontSize: 15, fontWeight: '600', color: THEME.ink },
  reorderTotalValue: { fontSize: 17, fontWeight: '600', color: THEME.ink },

  // Delivery address — list, cards & form
  addrSectionTitle: { fontSize: 15, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, marginBottom: 12 },
  addrCard: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 14, marginBottom: 12, ...THEME.shadowSm },
  addrCardOn: { borderColor: THEME.brand, borderWidth: 2, padding: 13 },
  addrCardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addrTypeIcon: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  addrType: { fontSize: 14.5, fontWeight: '600', color: THEME.ink },
  addrBadge: { backgroundColor: THEME.terraSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 8 },
  addrBadgeTxt: { fontSize: 9.5, fontWeight: '600', color: THEME.terraDark, letterSpacing: 0.4, textTransform: 'uppercase' },
  addrCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  addrName: { fontSize: 13.5, fontWeight: '700', color: THEME.ink, marginBottom: 3 },
  addrText: { fontSize: 13, color: THEME.muted, fontWeight: '600', lineHeight: 19 },
  addrDivider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },
  addrActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addrAction: { flexDirection: 'row', alignItems: 'center' },
  addrActionTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.ink, marginLeft: 7 },
  addrEmpty: { alignItems: 'center', paddingVertical: 44 },
  addrEmptyIcon: { width: 58, height: 58, borderRadius: 16, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  addrEmptyTxt: { fontSize: 14, fontWeight: '700', color: THEME.muted },
  addrFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },
  addrTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.champ, borderRadius: 999, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  addrTypeBtnOn: { backgroundColor: MARCHE.noir, borderColor: MARCHE.noir },
  addrTypeBtnTxt: { fontSize: 14, fontWeight: '700', color: THEME.muted, marginLeft: 8 },
  addrTypeBtnTxtOn: { color: MARCHE.blanc, fontWeight: '600' },
});

const EMPTY_ADDR_FORM = {
  first_name: '', last_name: '', phone_code: '+33', phone_number: '',
  house_building: '', road_area_colony: '', pincode: '', city: '',
  state: '', address_type: 'home', countryFlag: 'FR', lat: null, lang: null,
};

// Nettoie un libelle de retrait stocke ("Aujourd'hui 13 juil", fige a l'achat) : retire le mot relatif perime.
function cleanPickupDate(label, t) {
  if (!label) return '';
  let s = String(label).trim();
  for (const key of ['cart.today', 'cart.tomorrow']) {
    const w = t(key);
    if (w && s.toLowerCase().startsWith((w + ' ').toLowerCase())) { s = s.slice(w.length + 1).trim(); break; }
  }
  return s;
}

// Pages légales publiques (politique de confidentialité, conditions d'utilisation), visibles avec ou sans compte.
function LegalLinks() {
  const { t } = useTranslation();
  const ouvrir = (url) => { Linking.openURL(url).catch(() => {}); };
  return (
    <View style={profStyles.section}>
      <Text style={profStyles.guestPrefTitle}>{t('profile.legalTitle', 'Informations légales')}</Text>
      <View style={profStyles.settingsCard}>
        <TouchableOpacity activeOpacity={0.8} accessibilityRole="link" onPress={() => ouvrir(LEGAL_URLS.privacy)} style={[profStyles.settingRow, profStyles.settingDivider]}>
          <View style={profStyles.settingIcon}>
            <Ionicons name="shield-checkmark-outline" size={19} color="#1C1917" />
          </View>
          <View style={profStyles.settingBody}>
            <Text style={profStyles.settingLabel}>{t('profile.privacyPolicy', 'Politique de confidentialité')}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={THEME.faint} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} accessibilityRole="link" onPress={() => ouvrir(LEGAL_URLS.terms)} style={profStyles.settingRow}>
          <View style={profStyles.settingIcon}>
            <Ionicons name="document-text-outline" size={19} color="#1C1917" />
          </View>
          <View style={profStyles.settingBody}>
            <Text style={profStyles.settingLabel}>{t('profile.termsOfUse', "Conditions d'utilisation")}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={THEME.faint} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FakeProfileScreen({ onLogout, isAuth }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const { currency, setCurrency, fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const [profile, setProfile] = React.useState({ nom: '', prenom: '', pseudo: '', photo: null });
  const [editVisible, setEditVisible] = React.useState(false);
  const [editNom, setEditNom] = React.useState('');
  const [editPrenom, setEditPrenom] = React.useState('');
  const [editPseudo, setEditPseudo] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [showPwdChange, setShowPwdChange] = React.useState(false);
  // Suppression du compte en cours : bloque un second envoi pendant l'appel.
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const deletingAccountRef = React.useRef(false);
  const loggingOutRef = React.useRef(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [pwdError, setPwdError] = React.useState('');
  const [pwdSuccess, setPwdSuccess] = React.useState('');
  const [orders, setOrders] = React.useState([]);
  const [allOrdersVisible, setAllOrdersVisible] = React.useState(false);
  const [detailOrder, setDetailOrder] = React.useState(null);
  const [reorderVisible, setReorderVisible] = React.useState(false);
  const [reorderItems, setReorderItems] = React.useState([]); // [{...item, selected: true/false}]
  const [langVisible, setLangVisible] = React.useState(false);
  const [pendingLang, setPendingLang] = React.useState(null);
  const [currencyVisible, setCurrencyVisible] = React.useState(false);
  const [pendingCurrency, setPendingCurrency] = React.useState(null);
  const [paymentMethodsVisible, setPaymentMethodsVisible] = React.useState(false); // section Moyens de paiement (cartes)
  const [favVisible, setFavVisible] = React.useState(false); // Favoris déplacé dans Profil (dispo sans connexion)
  // Partage de listes : demandes reçues + utilisateurs bloqués
  const [shareRequests, setShareRequests] = React.useState([]);
  const [blockedUsers, setBlockedUsers] = React.useState([]);
  const [shareRequestsVisible, setShareRequestsVisible] = React.useState(false);
  const loadShareData = React.useCallback(async () => {
    try {
      const tok = await getTokens();
      if (!tok) { setShareRequests([]); setBlockedUsers([]); return; }
      const [inc, blk] = await Promise.all([getIncomingRequests(), getBlocks()]);
      if (inc && inc.status) setShareRequests(inc.data?.requests || []);
      if (blk && blk.status) setBlockedUsers(blk.data?.blocked || []);
    } catch {}
  }, []);
  React.useEffect(() => { loadShareData(); }, [loadShareData]);
  // Exécute une action de partage avec retour d'erreur (les appels API ne throwent
  // pas sur non-2xx : on vérifie res.status et on prévient l'utilisateur si échec).
  const runShareAction = async (fn) => {
    try {
      const res = await fn();
      if (res && res.status === false) {
        Alert.alert(t('listScreen.shareFailedTitle', 'Échec'), (res && res.message) || t('listScreen.shareActionFailed', "L'action n'a pas pu être effectuée."));
      }
    } catch {
      Alert.alert(t('listScreen.shareFailedTitle', 'Échec'), t('auth.errorNetwork', 'Connexion au serveur impossible.'));
    }
    loadShareData();
  };
  const [addressListVisible, setAddressListVisible] = React.useState(false);
  const [addresses, setAddresses] = React.useState([]);
  const [addressLoading, setAddressLoading] = React.useState(false);
  const [addressFormVisible, setAddressFormVisible] = React.useState(false);
  const [editingAddressId, setEditingAddressId] = React.useState(null);
  const [addrForm, setAddrForm] = React.useState(EMPTY_ADDR_FORM);
  const [addrPhotonSuggestions, setAddrPhotonSuggestions] = React.useState([]);
  const addrPhotonDebounce = React.useRef(null);
  const [addrSaving, setAddrSaving] = React.useState(false);
  const [geoLoading, setGeoLoading] = React.useState(false);
  const [driverInfoVisible, setDriverInfoVisible] = React.useState(false);
  const [docStatuses, setDocStatuses] = React.useState(null);
  const [driverMode, setDriverMode] = React.useState(false);
  const [driverCountry, setDriverCountryState] = React.useState('FR');
  const [driverEarnings, setDriverEarnings] = React.useState({ total_year: 0, remaining: 3000, limit: 3000 });
  const [driverBlocked, setDriverBlocked] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    try {
      // Try to fetch from Marketplace API first
      const apiProfile = await apiGetProfile();
      if (apiProfile && apiProfile.id) {
        setProfile(apiProfile);
        return;
      }
    } catch(e) {}
    // Fallback to local storage
    try {
      const raw = await getSecureItem(KEY_PROFILE);
      if (raw) setProfile(JSON.parse(raw));
    } catch(e) {}
  }, []);
  // Vrai statut backend par order_id Marketplace (dont remboursement). Alimenté
  // au focus ; utilisé par getOrderStatus pour refléter le cycle de vie réel.
  const [marketplaceStatuses, setMarketplaceStatuses] = React.useState({});
  const loadOrders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
      if (raw) setOrders(JSON.parse(raw));
    } catch(e) {}
    // Relit le VRAI statut des commandes Marketplace (remboursé/annulé/prête/
    // terminée) pour l'afficher à la place du statut simulé. Silencieux si KO.
    try {
      const map = await getMarketplaceOrderStatuses();
      if (map && typeof map === 'object') setMarketplaceStatuses(map);
    } catch(e) {}
  }, []);
  const loadAddresses = React.useCallback(async () => {
    setAddressLoading(true);
    try {
      const list = await fetchAddresses();
      setAddresses(Array.isArray(list) ? list : []);
    } catch(e) {}
    setAddressLoading(false);
  }, []);

  // Notification de commande touchée (services/pushToucher.js) : détail de la
  // commande concernée, retrouvée dans l'historique de l'appareil. iOS n'empile
  // pas deux Modal : la liste complète ou la fiche livreur est fermée d'abord,
  // le détail suit 300 ms plus tard. Introuvable : le Profil seul.
  const autreModaleOuverte = React.useRef(false);
  autreModaleOuverte.current = allOrdersVisible || driverInfoVisible;
  const ouvrirCommandeDepuisPush = React.useCallback(async () => {
    const cible = prendreCommandeAOuvrir();
    if (!cible) return;
    const order = await trouverCommande(cible);
    if (!order) return;
    if (autreModaleOuverte.current) {
      setAllOrdersVisible(false);
      setDriverInfoVisible(false);
      setTimeout(() => setDetailOrder(order), 300);
    } else {
      setDetailOrder(order);
    }
  }, []);
  // L'onglet peut ne pas être monté quand l'évènement part : la commande est
  // aussi prise au focus ci-dessous.
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVENEMENT_OUVRIR, () => { ouvrirCommandeDepuisPush(); });
    return () => sub.remove();
  }, [ouvrirCommandeDepuisPush]);
  // Demande de partage (push ou lien pearl-list://partage) : fenêtre
  // « Demandes de partage », rechargée, après fermeture d'une autre modale.
  const ouvrirPartageDepuisPush = React.useCallback(() => {
    if (!prendrePartageAOuvrir()) return;
    loadShareData();
    if (autreModaleOuverte.current) {
      setAllOrdersVisible(false);
      setDriverInfoVisible(false);
      setTimeout(() => setShareRequestsVisible(true), 300);
    } else {
      setShareRequestsVisible(true);
    }
  }, [loadShareData]);
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVENEMENT_PARTAGE, () => { ouvrirPartageDepuisPush(); });
    return () => sub.remove();
  }, [ouvrirPartageDepuisPush]);

  useFocusEffect(React.useCallback(() => {
    loadProfile(); loadOrders(); loadAddresses();
    ouvrirCommandeDepuisPush();
    ouvrirPartageDepuisPush();
    // Load driver mode status for regular users
    (async () => {
      try {
        const dm = await isDriverMode();
        setDriverMode(dm);
        const cc = await getDriverCountry();
        setDriverCountryState(cc);
        if (dm) {
          const earnings = await getDriverEarnings();
          setDriverEarnings(earnings);
          const ok = await canDeliver();
          setDriverBlocked(!ok);
        }
      } catch(e) {}
    })();
    // Load document verification status for pro users
    (async () => {
      try {
        const authRaw = await getSecureItem(KEY_AUTH);
        const auth = authRaw ? JSON.parse(authRaw) : {};
        if (auth.role === 'professionaluser') {
          const data = await getDocumentStatus();
          if (data && data.status && data.document_status) {
            setDocStatuses(data.document_status);
            // Update isVerified in profile
            if (data.document_status.is_verified) {
              const profRaw = await getSecureItem(KEY_PROFILE);
              const prof = profRaw ? JSON.parse(profRaw) : {};
              if (!prof.isVerified) {
                prof.isVerified = true;
                await setSecureItem(KEY_PROFILE, JSON.stringify(prof));
                setProfile(prof);
              }
            }
          }
        }
      } catch(e) {}
    })();
  }, [loadProfile, loadOrders, loadAddresses, ouvrirCommandeDepuisPush]));

  React.useEffect(() => {
    if (isAuth) { loadProfile(); loadOrders(); }
  }, [isAuth, loadProfile, loadOrders]);

  const saveProfile = async () => {
    const updated = { ...profile, nom: editNom.trim(), prenom: editPrenom.trim(), pseudo: editPseudo.trim(), email: editEmail.trim() };
    // Try to update on Marketplace backend first
    try {
      await apiUpdateProfile({
        prenom: editPrenom.trim(),
        nom: editNom.trim(),
        pseudo: editPseudo.trim(),
        email: editEmail.trim(),
      });
    } catch(e) {}
    setProfile(updated);
    await setSecureItem(KEY_PROFILE, JSON.stringify(updated));
    setEditVisible(false);
  };

  const setAF = (k, v) => setAddrForm(f => ({ ...f, [k]: v }));

  // Autocomplétion d'adresse (Photon) dans le formulaire du profil — même
  // comportement que l'inscription : on tape la rue, on choisit, tout se remplit.
  const onAddrStreetChange = (v) => {
    setAF('house_building', v);
    if (addrPhotonDebounce.current) clearTimeout(addrPhotonDebounce.current);
    const q = (v || '').trim();
    if (q.length < 3) { setAddrPhotonSuggestions([]); return; }
    const cc = (addrForm.countryFlag || 'FR').toUpperCase();
    addrPhotonDebounce.current = setTimeout(async () => {
      setAddrPhotonSuggestions(await fetchPhotonSuggestions(q, cc, i18nInstance.language));
    }, 300);
  };
  const pickProfileAddress = (s) => {
    if (addrPhotonDebounce.current) clearTimeout(addrPhotonDebounce.current);
    setAddrForm(f => ({
      ...f,
      house_building: s.address || s.label,
      pincode: s.postcode || f.pincode,
      city: s.city || f.city,
      lat: s.lat ?? f.lat,
      lang: s.lng ?? f.lang,
    }));
    setAddrPhotonSuggestions([]);
  };

  const openAddressList = () => { setAddressListVisible(true); loadAddresses(); };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddrForm(EMPTY_ADDR_FORM);
    setAddressFormVisible(true);
  };

  const openEditAddress = (item) => {
    setEditingAddressId(item.id);
    setAddrForm({
      first_name: item.first_name || '', last_name: item.last_name || '',
      phone_code: item.phone_code || '+33', phone_number: item.phone_number || '',
      house_building: item.house_building || '', road_area_colony: item.road_area_colony || '',
      pincode: item.pincode || '', city: item.city || '', state: item.state || '',
      address_type: item.address_type === 'work' ? 'work' : 'home',
      countryFlag: item.countryFlag || 'FR',
      lat: item.lat ?? null, lang: item.lang ?? null,
    });
    setAddressFormVisible(true);
  };

  const submitAddress = async () => {
    if (!addrForm.first_name.trim() || !addrForm.house_building.trim() || !addrForm.city.trim()) {
      Alert.alert(t('profile.deliveryAddress'), t('profile.pwdErrorEmpty'));
      return;
    }
    setAddrSaving(true);
    try {
      const payload = {
        first_name: addrForm.first_name.trim(),
        last_name: addrForm.last_name.trim(),
        phone_code: (addrForm.phone_code || '').trim() || '+33',
        phone_number: addrForm.phone_number.trim(),
        house_building: addrForm.house_building.trim(),
        road_area_colony: addrForm.road_area_colony.trim(),
        pincode: addrForm.pincode.trim(),
        city: addrForm.city.trim(),
        state: addrForm.state.trim(),
        address_type: addrForm.address_type,
        countryFlag: addrForm.countryFlag || 'FR',
        lat: addrForm.lat, lang: addrForm.lang,
      };
      if (editingAddressId) await updateAddress(editingAddressId, payload);
      else await createAddress(payload);
      await loadAddresses();
      setAddressFormVisible(false);
    } catch (e) {
      Alert.alert(t('profile.deliveryAddress'), t('profile.addrSaveError', 'Could not save the address.'));
    }
    setAddrSaving(false);
  };

  const confirmDeleteAddress = (id) => {
    Alert.alert(
      t('profile.deliveryAddress'),
      t('profile.addrDeleteConfirm', 'Delete this address?'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        { text: t('profile.delete', 'Delete'), style: 'destructive', onPress: async () => {
          try { await deleteAddressById(id); await loadAddresses(); } catch (e) {}
        } },
      ]
    );
  };

  const selectDefaultAddress = async (id) => {
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    try { await makeAddressDefault(id); } catch (e) {}
    loadAddresses();
  };

  const addressGeo = async () => {
    try {
      setGeoLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeoLoading(false);
        Alert.alert(t('profile.locationDenied'), t('profile.locationDeniedMsg'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const r = results && results[0];
      if (r) {
        setAddrForm(f => ({
          ...f,
          house_building: ((r.streetNumber || '') + ' ' + (r.street || r.name || '')).trim() || f.house_building,
          road_area_colony: r.district || r.subregion || f.road_area_colony,
          city: r.city || r.region || f.city,
          pincode: r.postalCode || f.pincode,
          state: r.region || f.state,
          countryFlag: r.isoCountryCode || f.countryFlag,
          lat: loc.coords.latitude, lang: loc.coords.longitude,
        }));
      } else {
        Alert.alert(t('profile.deliveryAddress'), t('profile.locationError'));
      }
      setGeoLoading(false);
    } catch (e) {
      setGeoLoading(false);
      Alert.alert(t('profile.deliveryAddress'), t('profile.locationError'));
    }
  };

  const defaultAddress = addresses.find(a => a.is_default) || addresses[0] || null;
  // Repli : si le carnet d'adresses est vide, on affiche l'adresse donnée à
  // l'inscription (stockée sur le profil) plutôt que « Non définie ».
  const registrationAddress = React.useMemo(() => {
    const a = (profile && (profile.manualAddress || profile.automatic_address)) || null;
    if (!a) return '';
    return [a.address1, a.address2, a.postalCode, a.city].filter(Boolean).join(', ');
  }, [profile]);

  const handleChangePassword = async () => {
    setPwdError(''); setPwdSuccess('');
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { setPwdError(t('profile.pwdErrorEmpty')); return; }
    if (newPassword !== confirmPassword) { setPwdError(t('profile.pwdErrorMismatch')); return; }
    if (newPassword.length < 6) { setPwdError(t('profile.pwdErrorLength')); return; }
    try {
      // Uniquement par le serveur Marketplace : aucun mot de passe n'est
      // gardé ni comparé en local.
      const apiResult = await apiUpdatePassword(oldPassword, newPassword);
      if (apiResult && apiResult.status) {
        setPwdSuccess(t('profile.pwdSuccess'));
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        setTimeout(() => { setShowPwdChange(false); setPwdSuccess(''); }, 1500);
        return;
      }
      const oldWrong = !!(apiResult && apiResult.errors && apiResult.errors.old_password);
      setPwdError(oldWrong ? t('profile.pwdErrorOld') : t('profile.pwdErrorGeneral'));
    } catch(e) { setPwdError(t('profile.pwdErrorGeneral')); }
  };

  const pickPhoto = async () => {
    // Android : sélecteur de photos du système, aucune permission (règle Google Play
    // sur READ_MEDIA_IMAGES, bloquée dans app.json). iOS : autorisation demandée.
    if (Platform.OS !== 'android') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('profile.photoPermissionTitle'), t('profile.photoPermissionMsg'));
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const updated = { ...profile, photo: uri };
      setProfile(updated);
      await setSecureItem(KEY_PROFILE, JSON.stringify(updated));
      // Sync photo with Marketplace backend
      try { await uploadProfilePhoto(uri); } catch(e) {}
    }
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  };

  const initials = (profile.prenom || profile.nom || '').trim().charAt(0).toUpperCase();
  // Avatar ring reflects the user's status — a new user (no orders yet) gets a blue ring.
  const statusRingColor = (orders.length === 0) ? '#3B82F6' : BRAND;

  // Track delivery status from API for delivery orders
  const [deliveryStatuses, setDeliveryStatuses] = React.useState({});

  // Poll delivery status for recent delivery orders
  React.useEffect(() => {
    let mounted = true;
    const pollDeliveryStatuses = async () => {
      const recentDeliveryOrders = orders.filter(o => o.mode === 'delivery' && o.deliveryStatus && o.deliveryStatus !== DELIVERY_STATUS.DELIVERED && o.deliveryStatus !== DELIVERY_STATUS.CANCELLED);
      for (const order of recentDeliveryOrders.slice(0, 5)) {
        try {
          const status = await getDeliveryStatus(order.id);
          if (mounted && status && status.status) {
            setDeliveryStatuses(prev => ({ ...prev, [order.id]: status }));
            // Update order in history
            const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
            if (raw) {
              const hist = JSON.parse(raw);
              const idx = hist.findIndex(o => o.id === order.id);
              if (idx >= 0 && hist[idx].deliveryStatus !== status.status) {
                hist[idx].deliveryStatus = status.status;
                hist[idx].driverName = status.driver_name || '';
                hist[idx].driverPhone = status.driver_phone || '';
                hist[idx].estimatedArrival = status.estimated_arrival || '';
                hist[idx].deliveryCode = status.delivery_code || hist[idx].deliveryCode || '';
                await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(hist));
              }
            }
          }
        } catch(e) {}
      }
    };
    if (orders.length > 0) {
      pollDeliveryStatuses();
      const interval = setInterval(pollDeliveryStatuses, 30000); // Poll every 30s
      return () => { mounted = false; clearInterval(interval); };
    }
    return () => { mounted = false; };
  }, [orders]);

  // Suivi LIVE (type Uber Eats) : quand le modal détail est ouvert sur une
  // livraison EN COURS, on rafraîchit la position du livreur toutes les 5 s
  // (carte + ETA fluides). S'arrête à la livraison/annulation ou à la fermeture.
  React.useEffect(() => {
    if (!detailOrder || detailOrder.mode !== 'delivery') return;
    let mounted = true, stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const status = await getDeliveryStatus(detailOrder.id);
        if (!mounted || !status || !status.status) return;
        setDeliveryStatuses(prev => ({ ...prev, [detailOrder.id]: status }));
        const s2 = String(status.status).toLowerCase();
        if (s2 === 'delivered' || s2 === 'cancelled') stopped = true;
      } catch (e) {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, [detailOrder]);

  // Pourboire APRÈS livraison (type Uber Eats) : débite la carte enregistrée et
  // crédite le livreur, puis rafraîchit le suivi (reçu à jour).
  const [tipLoading, setTipLoading] = React.useState(false);
  const submitPostTip = React.useCallback(async (orderId, amount) => {
    setTipLoading(true);
    try {
      // Clé d'idempotence stable pour CETTE action (générée une fois) → un retry
      // réseau réutilise le même corps → pas de double débit côté serveur.
      const idemKey = `tip-${orderId}-${amount}-${Date.now()}`;
      const res = await addDeliveryTip(orderId, amount, idemKey);
      if (res && res.status === 'success') {
        const s = await getDeliveryStatus(orderId);
        if (s && s.status) setDeliveryStatuses(prev => ({ ...prev, [orderId]: s }));
        Alert.alert(t('cart.tipThanks', 'Merci !'), t('cart.tipAdded', 'Pourboire ajouté.'));
      } else {
        Alert.alert(t('cart.tip', 'Pourboire'), (res && res.message) || t('cart.tipFailed', 'Échec du pourboire.'));
      }
    } catch (e) {
      Alert.alert(t('cart.tip', 'Pourboire'), t('cart.tipFailed', 'Échec du pourboire.'));
    } finally { setTipLoading(false); }
  }, [t]);

  // Notation du livreur (post-livraison) + signalement de problème (type Uber Eats).
  const submitRating = React.useCallback(async (orderId, stars) => {
    try {
      const res = await rateDelivery(orderId, stars);
      if (res && (res.status === 'success' || res.status === true)) {
        const s = await getDeliveryStatus(orderId);
        if (s && s.status) setDeliveryStatuses(prev => ({ ...prev, [orderId]: s }));
        Alert.alert(t('rating.thanks', 'Merci !'), t('rating.saved', 'Votre note a été enregistrée.'));
      }
    } catch (e) {}
  }, [t]);
  const submitReport = React.useCallback((orderId) => {
    const cats = [
      { key: 'not_received', label: t('report.notReceived', 'Commande non reçue') },
      { key: 'missing_item', label: t('report.missingItem', 'Article manquant') },
      { key: 'wrong_order', label: t('report.wrongOrder', 'Mauvaise commande') },
      { key: 'damaged', label: t('report.damaged', 'Commande endommagée') },
      { key: 'other', label: t('report.other', 'Autre') },
    ];
    Alert.alert(
      t('report.title', 'Signaler un problème'),
      t('report.pick', "Que s'est-il passé ?"),
      [
        ...cats.map(c => ({ text: c.label, onPress: async () => {
          try {
            const res = await reportDeliveryProblem(orderId, c.key);
            if (res && res.status === 'success') {
              Alert.alert(t('report.sentTitle', 'Signalement envoyé'), t('report.sent', 'Notre support va traiter votre demande.'));
            }
          } catch (e) {}
        } })),
        { text: t('common.cancel', 'Annuler'), style: 'cancel' },
      ],
    );
  }, [t]);

  // Annulation par le client (course livraison). Le serveur décide : refus 409
  // (`already_in_preparation` / `already_picked_up`) dès qu'une boutique a
  // commencé la préparation ou qu'un livreur a récupéré la course. Après un
  // refus, le bouton ne revient plus (cancelRefused gardé dans l'historique).
  const [annulation, setAnnulation] = React.useState({}); // orderId -> 'busy' | 'done' | 'tooLate' | 'failed'
  const majCommandeLocale = React.useCallback(async (orderId, patch) => {
    setOrders(prev => (Array.isArray(prev) ? prev.map(o => (o && o.id === orderId ? { ...o, ...patch } : o)) : prev));
    setDetailOrder(d => (d && d.id === orderId ? { ...d, ...patch } : d));
    try {
      const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
      const hist = raw ? JSON.parse(raw) : [];
      const idx = Array.isArray(hist) ? hist.findIndex(o => o && o.id === orderId) : -1;
      if (idx >= 0) {
        hist[idx] = { ...hist[idx], ...patch };
        await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(hist));
      }
    } catch (_) {}
  }, []);
  const annulerCommande = React.useCallback((orderId) => {
    Alert.alert(
      t('cancel.confirmTitle', 'Annuler la commande ?'),
      t('cancel.confirmMsg', 'Vous serez remboursé intégralement.'),
      [
        { text: t('cancel.keep', 'Garder'), style: 'cancel' },
        { text: t('cancel.button', 'Annuler la commande'), style: 'destructive', onPress: async () => {
          setAnnulation(p => ({ ...p, [orderId]: 'busy' }));
          try {
            await cancelDelivery(orderId);
            setDeliveryStatuses(prev => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), status: DELIVERY_STATUS.CANCELLED } }));
            await majCommandeLocale(orderId, { deliveryStatus: DELIVERY_STATUS.CANCELLED });
            setAnnulation(p => ({ ...p, [orderId]: 'done' }));
          } catch (e) {
            if (refusAnnulation(e)) {
              await majCommandeLocale(orderId, { cancelRefused: true });
              setAnnulation(p => ({ ...p, [orderId]: 'tooLate' }));
            } else {
              setAnnulation(p => ({ ...p, [orderId]: 'failed' }));
            }
          }
        } },
      ],
    );
  }, [t, majCommandeLocale]);

  // Get order status - uses delivery API for delivery orders, simulated for collect
  const getOrderStatus = (order) => {
    // VRAI statut backend (dont remboursement) si la commande a un order_id
    // Marketplace (tunnel carte). Prime sur le statut simulé ci-dessous.
    const mids = Array.isArray(order.marketplaceOrderIds) ? order.marketplaceOrderIds : [];
    if (mids.length > 0) {
      const infos = mids.map(id => marketplaceStatuses[String(id)]).filter(Boolean);
      if (infos.length > 0) {
        const st = (i) => String(i.status || '').toLowerCase();
        const has = (pred) => infos.some(pred);
        const isCollect = order.mode === 'collect';
        if (has(i => i.is_refunded || st(i) === 'refunded'))
          return { step: -1, label: t('orderStatus.refunded', 'Remboursée'), color: '#6B7280', icon: 'arrow-undo-circle' };
        if (has(i => i.is_partially_refunded || st(i) === 'partially_refunded' || st(i) === 'partial_refunded'))
          return { step: -1, label: t('orderStatus.partiallyRefunded', 'Partiellement remboursée'), color: '#F59E0B', icon: 'arrow-undo' };
        if (has(i => st(i) === 'cancelled' || st(i) === 'canceled'))
          return { step: -1, label: t('orderStatus.cancelled'), color: '#EF4444', icon: 'close-circle' };
        if (has(i => st(i) === 'awaiting_payment'))
          return { step: 0, label: t('orderStatus.awaitingPayment', 'En attente de paiement'), color: '#F59E0B', icon: 'time-outline' };
        if (has(i => ['completed','fulfilled','delivered','picked_up','served','finished'].includes(st(i))))
          return { step: 5, label: t('orderStatus.completed', 'Terminée'), color: '#059669', icon: 'checkmark-done' };
        if (has(i => ['processing','ready','prete','prêt'].includes(st(i))))
          return isCollect
            ? { step: 2, label: t('orderStatus.ready'), color: '#059669', icon: 'bag-handle' }
            : { step: 3, label: t('orderStatus.onTheWay'), color: '#F97316', icon: 'bicycle' };
        if (has(i => st(i) === 'accepted'))
          return { step: 1, label: t('orderStatus.preparing'), color: '#F59E0B', icon: 'storefront' };
        return { step: 0, label: t('orderStatus.confirmed'), color: '#059669', icon: 'checkmark-circle' };
      }
    }
    // For delivery orders, check real delivery status from API
    if (order.mode === 'delivery' && order.deliveryStatus) {
      const apiStatus = deliveryStatuses[order.id];
      if (apiStatus && apiStatus.status) {
        return getDeliveryStatusInfo(apiStatus.status, t);
      }
      // Fallback: use stored delivery status
      return getDeliveryStatusInfo(order.deliveryStatus, t);
    }

    // Simulated status based on time elapsed (collect mode or no delivery tracking)
    const elapsed = Date.now() - (order.id || Date.parse(order.date) || 0);
    const minutes = elapsed / 60000;
    const isCollect = order.mode === 'collect';
    if (minutes < 5) return { step: 0, label: t('orderStatus.confirmed'), color: '#059669', icon: 'checkmark-circle' };
    if (minutes < 15) return { step: 1, label: t('orderStatus.preparing'), color: '#F59E0B', icon: 'storefront' };
    if (minutes < 30) return { step: 2, label: isCollect ? t('orderStatus.ready') : t('orderStatus.onTheWay'), color: isCollect ? '#059669' : '#F97316', icon: isCollect ? 'bag-handle' : 'bicycle' };
    if (minutes < 45) return { step: 3, label: isCollect ? t('orderStatus.waitingPickup') : t('orderStatus.almostThere'), color: '#8B5CF6', icon: isCollect ? 'walk' : 'location' };
    return { step: 4, label: isCollect ? t('orderStatus.collected') : t('orderStatus.delivered'), color: '#059669', icon: 'checkmark-done' };
  };

  const OrderSteps = ({ mode }) => {
    const isCollect = mode === 'collect';
    const steps = isCollect ? [
      { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
      { icon: "storefront", label: t('orderStatus.preparingDone') },
      { icon: "bag-handle", label: t('orderStatus.ready') },
      { icon: "walk", label: t('orderStatus.pickedUp') },
      { icon: "checkmark-done", label: t('orderStatus.collected') },
    ] : [
      { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
      { icon: "storefront", label: t('orderStatus.preparingDone') },
      { icon: "bicycle", label: t('orderStatus.onTheWay') },
      { icon: "location", label: t('orderStatus.almostThere') },
      { icon: "home", label: t('orderStatus.delivered') },
    ];
    return (
      <View style={{ marginBottom:10 }}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <View style={{ width:24, height:24, borderRadius:12, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center' }}>
              <Ionicons name={step.icon} size={12} color={THEME.ink} />
            </View>
            {i < steps.length - 1 && (
              <View style={{ position:'absolute', left:11, top:24, width:2, height:6, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card }} />
            )}
            <Text style={{ fontSize:12, fontWeight:'600', color:THEME.ink, marginLeft:8 }}>{step.label}</Text>
            <Ionicons name="checkmark" size={14} color={THEME.terra} style={{ marginLeft:6 }} />
          </View>
        ))}
      </View>
    );
  };

  // Favoris présenté en plein écran depuis Profil (fini l'onglet dédié). Monté à
  // l'ouverture seulement → rechargement frais des favoris (stockés localement,
  // donc dispo même sans connexion).
  const favModal = favVisible ? (
    <Modal visible animationType="slide" onRequestClose={() => setFavVisible(false)}>
      <FavoritesScreen onClose={() => setFavVisible(false)} />
    </Modal>
  ) : null;

  if (!isAuth) {
    return (
      <SafeAreaView style={profStyles.screen} edges={['top']}>
        <View style={profStyles.header}>
          <Text style={profStyles.title}>{t('tabs.profile')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {/* Hero connexion — design soigné */}
          <View style={profStyles.guestHero}>
            <View style={profStyles.guestHeroIcon}>
              <Ionicons name="person-circle-outline" size={54} color="#1C1917" />
            </View>
            <Text style={profStyles.guestHeroTitle}>{t('profile.guestTitle', 'Vous n\'êtes pas connecté')}</Text>
            <Text style={profStyles.guestHeroHint}>{t('profile.guestHint', 'Connectez-vous pour gérer votre profil, vos commandes et la livraison.')}</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={() => DeviceEventEmitter.emit('OPEN_AUTH')} style={profStyles.guestHeroBtn}>
              <Ionicons name="log-in-outline" size={20} color={MARCHE.blanc} />
              <Text style={profStyles.guestHeroBtnTxt}>{t('auth.loginBtn', 'Se connecter')}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={() => DeviceEventEmitter.emit('OPEN_AUTH', { signup: true })} style={profStyles.guestHeroBtnAlt}>
              <Ionicons name="person-add-outline" size={19} color="#1C1917" />
              <Text style={profStyles.guestHeroBtnAltTxt}>{t('auth.signupBtn', 'Créer un compte')}</Text>
            </TouchableOpacity>
          </View>

          {/* Favoris — accessibles SANS connexion (stockés localement) */}
          <View style={profStyles.section}>
            <View style={profStyles.settingsCard}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setFavVisible(true)} style={profStyles.settingRow}>
                <View style={profStyles.settingIcon}>
                  <Ionicons name="heart-outline" size={19} color="#1C1917" />
                </View>
                <View style={profStyles.settingBody}>
                  <Text style={profStyles.settingLabel}>{t('tabs.favorites')}</Text>
                  <Text style={profStyles.settingValue}>{t('favorites.manageHint', 'Vos boutiques et produits favoris')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Préférences — accessibles SANS connexion */}
          <View style={profStyles.section}>
            <Text style={profStyles.guestPrefTitle}>{t('profile.preferences', 'Préférences')}</Text>
            <View style={profStyles.settingsCard}>
              {/* Langue */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => setLangVisible(true)} style={[profStyles.settingRow, profStyles.settingDivider]}>
                <View style={profStyles.settingIcon}>
                  <Ionicons name="language-outline" size={19} color="#1C1917" />
                </View>
                <View style={profStyles.settingBody}>
                  <Text style={profStyles.settingLabel}>{t('profile.language')}</Text>
                  <Text style={profStyles.settingValue}>
                    {LANGUAGES.find(l => l.code === i18nInstance.language)?.flag || '🌐'} {({'fr':'Français','en':'English','es':'Español','zh':'中文','ar':'العربية','de':'Deutsch','nl':'Nederlands','it':'Italiano','pt':'Português','ja':'日本語','th':'ไทย','sv':'Svenska','ru':'Русский'})[i18nInstance.language] || i18nInstance.language}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
              </TouchableOpacity>
              {/* Devise */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => setCurrencyVisible(true)} style={profStyles.settingRow}>
                <View style={profStyles.settingIcon}>
                  <Ionicons name="cash-outline" size={19} color="#1C1917" />
                </View>
                <View style={profStyles.settingBody}>
                  <Text style={profStyles.settingLabel}>{t('profile.currency')}</Text>
                  <Text style={profStyles.settingValue}>{currency.flag} {currency.code}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
              </TouchableOpacity>
            </View>
          </View>

          <LegalLinks />
        </ScrollView>

        {/* Sélecteur de langue (dispo sans connexion) */}
        {/* Partage de listes : demandes reçues + utilisateurs bloqués */}
        <Modal visible={shareRequestsVisible} animationType="slide" onRequestClose={() => setShareRequestsVisible(false)}>
          <SafeAreaView style={{ flex:1, backgroundColor:THEME.bg }}>
            <View style={{ flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:THEME.border }}>
              <TouchableOpacity onPress={() => setShareRequestsVisible(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Ionicons name="arrow-back" size={24} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={{ marginLeft:12, fontSize:18, fontFamily: SERIF, fontWeight:'600', color:THEME.ink }}>{t('profile.listShares', 'Partage de listes')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding:16 }}>
              <Text style={profStyles.sectionTitle}>{t('profile.pendingRequestsTitle', 'Demandes reçues')}</Text>
              {shareRequests.length === 0 && <Text style={{ color:THEME.faint, marginBottom:16 }}>{t('profile.noRequests', 'Aucune demande pour le moment.')}</Text>}
              {shareRequests.map((r) => (
                <View key={String(r.request_id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                  <Ionicons name="person-circle-outline" size={34} color={THEME.brandDark} />
                  <Text style={{ flex:1, marginHorizontal:10, fontWeight:'700', color:THEME.ink }} numberOfLines={1}>{r.from?.name || '-'}</Text>
                  <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'accept'))} style={{ borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card, borderRadius:TAILLES.rayonBouton, paddingHorizontal:14, height:TAILLES.boutonPetit, alignItems:'center', justifyContent:'center', marginRight:6 }}>
                    <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:13 }}>{t('profile.accept', 'Accepter')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'reject'))} style={{ padding:6, marginRight:2 }}>
                    <Ionicons name="close" size={20} color={THEME.faint} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { if (r.from?.id) runShareAction(() => blockUserById(r.from.id)); }} style={{ padding:6 }}>
                    <Ionicons name="ban-outline" size={20} color={THEME.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={[profStyles.sectionTitle, { marginTop:24 }]}>{t('profile.blockedUsers', 'Utilisateurs bloqués')}</Text>
              {blockedUsers.length === 0 && <Text style={{ color:THEME.faint }}>{t('profile.noBlocked', 'Aucun utilisateur bloqué.')}</Text>}
              {blockedUsers.map((u) => (
                <View key={String(u.id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                  <Ionicons name="ban" size={22} color={THEME.danger} />
                  <Text style={{ flex:1, marginHorizontal:10, color:THEME.ink }} numberOfLines={1}>{u.name || u.username}</Text>
                  <TouchableOpacity onPress={() => runShareAction(() => unblockUser(u.username))} style={{ borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, borderRadius:TAILLES.rayonBouton, paddingHorizontal:14, height:TAILLES.boutonPetit, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:13 }}>{t('profile.unblock', 'Débloquer')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal onRequestClose={() => { setPendingLang(null); setLangVisible(false); }} visible={langVisible} animationType="slide" onShow={() => setPendingLang(null)}>
          <SafeAreaView style={profStyles.modalScreen} edges={[]}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => { setPendingLang(null); setLangVisible(false); }} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{t('profile.language')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map(lang => {
                const currentLang = i18nInstance.language || 'fr';
                const isActive = currentLang === lang.code || currentLang.startsWith(lang.code);
                const isSelected = pendingLang === lang.code || (!pendingLang && isActive);
                return (
                  <TouchableOpacity key={lang.code} activeOpacity={0.8} onPress={() => setPendingLang(lang.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                    <Text style={profStyles.pickerFlag}>{lang.flag}</Text>
                    <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn, { flex:1 }]}>{lang.label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
              <View style={profStyles.sheetFooter}>
                <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                  const lang = pendingLang || i18nInstance.language;
                  definirOngletApresRechargement('profile');
                  i18nInstance.changeLanguage(lang);
                  await AsyncStorage.setItem('APP_LANGUAGE', lang);
                  setPendingLang(null);
                  setLangVisible(false);
                }} style={[profStyles.primaryBtn, !pendingLang && profStyles.primaryBtnDisabled]}>
                  <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </SafeAreaView>
        </Modal>

        {/* Sélecteur de devise (dispo sans connexion) */}
        <Modal onRequestClose={() => { setPendingCurrency(null); setCurrencyVisible(false); }} visible={currencyVisible} animationType="slide" onShow={() => setPendingCurrency(null)}>
          <SafeAreaView style={profStyles.modalScreen} edges={[]}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => { setPendingCurrency(null); setCurrencyVisible(false); }} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{t('profile.currency')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
              {CURRENCIES.map(curr => {
                const isSelected = pendingCurrency === curr.code || (!pendingCurrency && currency.code === curr.code);
                return (
                  <TouchableOpacity key={curr.code} activeOpacity={0.8} onPress={() => setPendingCurrency(curr.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                    <Text style={profStyles.pickerFlag}>{curr.flag}</Text>
                    <View style={{ flex:1 }}>
                      <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn]}>{t(`currencies.${curr.code}`, curr.name)}</Text>
                      <Text style={profStyles.pickerSub}>{curr.code}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
              <View style={profStyles.sheetFooter}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => {
                  const code = pendingCurrency || currency.code;
                  const found = CURRENCIES.find(c => c.code === code);
                  if (found) setCurrency(found);
                  setPendingCurrency(null);
                  setCurrencyVisible(false);
                }} style={[profStyles.primaryBtn, !pendingCurrency && profStyles.primaryBtnDisabled]}>
                  <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </SafeAreaView>
        </Modal>
        {favModal}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={profStyles.screen} edges={['top']}>
      <View style={profStyles.header}>
        <Text style={profStyles.title}>{t('tabs.profile')}</Text>
        <Text style={profStyles.subtitle}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text>
      </View>
      {favModal}
      {paymentMethodsVisible ? (
        <PaymentMethodsModal visible={paymentMethodsVisible} t={t} onClose={() => setPaymentMethodsVisible(false)} />
      ) : null}
      <ScrollView contentContainerStyle={{ paddingBottom:28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={profStyles.profileCard}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={profStyles.avatarWrap}>
            <View style={[profStyles.avatar, { borderColor: statusRingColor }]}>
              {profile.photo && (/^(https?:|data:|file:|content:)/i.test(profile.photo) || profile.photo.startsWith('/')) ? (
                <Image source={{ uri: profile.photo }} style={profStyles.avatarImg} />
              ) : (
                <Text style={profStyles.avatarInitials}>{initials || '👤'}</Text>
              )}
            </View>
            <View style={profStyles.avatarBadge}>
              <Ionicons name="camera" size={14} color="#1C1917" />
            </View>
          </TouchableOpacity>
          <Text style={profStyles.profileName}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text>
          {profile.pseudo ? <Text style={profStyles.profileHandle}>@{profile.pseudo}</Text> : null}

          <TouchableOpacity activeOpacity={0.85} onPress={() => { setEditNom(profile.nom); setEditPrenom(profile.prenom); setEditPseudo(profile.pseudo||''); setEditEmail(profile.email||''); setShowPwdChange(false); setPwdError(''); setPwdSuccess(''); setEditVisible(true); }} style={profStyles.editBtn}>
            <Ionicons name="create-outline" size={16} color={THEME.brandDark} />
            <Text style={profStyles.editBtnTxt}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Document Verification Status (Pro users) */}
        {profile.role === 'professionaluser' && (
          <View style={profStyles.section}>
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.verificationStatus', 'Statut de vérification')}</Text>
            </View>
            {!profile.isVerified && (
              <View style={[profStyles.banner, profStyles.bannerWarn]}>
                <Ionicons name="time-outline" size={20} color="#B45309" />
                <Text style={[profStyles.bannerTxt, { color:'#92400E' }]}>{t('profile.verificationPending', 'Votre compte est en cours de vérification par notre équipe.')}</Text>
              </View>
            )}
            {profile.isVerified && (
              <View style={[profStyles.banner, profStyles.bannerOk]}>
                <Ionicons name="checkmark-circle" size={20} color={THEME.brandDark} />
                <Text style={[profStyles.bannerTxt, { color:THEME.brandDark }]}>{t('profile.verificationApproved', 'Compte vérifié')}</Text>
              </View>
            )}
            {docStatuses && (
              <View style={profStyles.docCard}>
                {[
                  { key: 'kbiss_status', label: t('auth.docKbiss', 'Kbis') },
                  { key: 'iban_status', label: t('auth.docIban', 'IBAN / RIB') },
                  { key: 'identityCardFront_status', label: t('auth.docIdFront', 'Carte d\'identité (recto)') },
                  { key: 'identityCardBack_status', label: t('auth.docIdBack', 'Carte d\'identité (verso)') },
                  { key: 'proofOfAddress_status', label: t('auth.docProofAddress', 'Justificatif de domicile') },
                ].map((doc, i) => {
                  const status = docStatuses[doc.key] || 'pending';
                  const icon = status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline';
                  const color = status === 'approved' ? THEME.brand : status === 'rejected' ? THEME.danger : '#F59E0B';
                  const tint = status === 'approved' ? THEME.brandSoft : status === 'rejected' ? THEME.dangerSoft : '#FEF3C7';
                  const label = status === 'approved' ? (t('profile.docApproved', 'Approuvé')) : status === 'rejected' ? (t('profile.docRejected', 'Rejeté')) : (t('profile.docPending', 'En attente'));
                  return (
                    <View key={i} style={[profStyles.docRow, i < 4 && profStyles.docDivider]}>
                      <View style={[profStyles.docIcon, { backgroundColor: tint }]}>
                        <Ionicons name={icon} size={17} color={color} />
                      </View>
                      <Text style={profStyles.docLabel}>{doc.label}</Text>
                      <View style={[profStyles.docStatusPill, { backgroundColor: tint }]}>
                        <Text style={[profStyles.docStatusTxt, { color }]}>{label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Order History */}
        <View style={profStyles.section}>
          <View style={profStyles.sectionHeadRow}>
            <Text style={profStyles.sectionTitle}>{t('profile.orderHistory')}</Text>
            {orders.length > 0 ? <Text style={profStyles.sectionCount}>{orders.length}</Text> : null}
          </View>

          {orders.length === 0 ? (
            <View style={profStyles.empty}>
              <Text style={profStyles.emptyTitle}>{t('profile.noOrders')}</Text>
            </View>
          ) : (
            <>
              {orders.slice(0,3).map((order) => {
                const status = getOrderStatus(order);
                return (
                <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => setDetailOrder(order)} style={profStyles.orderCard}>
                  <View style={profStyles.orderRow}>
                    <View style={profStyles.orderIcon}>
                      <Ionicons name={status.icon} size={20} color={THEME.brand} />
                    </View>
                    <View style={profStyles.orderBody}>
                      <Text style={profStyles.orderTitle} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                      <View style={profStyles.orderStatusRow}>
                        <View style={[profStyles.orderDot, { backgroundColor: status.color }]} />
                        <Text style={[profStyles.orderStatusTxt, { color: status.color }]}>{status.label}</Text>
                      </View>
                      {(order.shops && order.shops.length > 0) ? (
                        <Text style={profStyles.orderShops} numberOfLines={1}>{order.shops.join(', ')}</Text>
                      ) : null}
                      <Text style={profStyles.orderDate}>{fmtDate(order.date)}</Text>
                    </View>
                    <View style={profStyles.orderSide}>
                      <View style={profStyles.modePill}>
                        <Text style={profStyles.modePillTxt}>
                          {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                        </Text>
                      </View>
                      <Text style={profStyles.orderPrice}>{fmtPrice(order.total||0)}</Text>
                      <Ionicons name="chevron-forward" size={16} color={THEME.faint} style={{marginTop:4}} />
                    </View>
                  </View>
                </TouchableOpacity>
                );
              })}
              {orders.length > 0 && (
                <TouchableOpacity activeOpacity={0.85} onPress={() => setAllOrdersVisible(true)} style={profStyles.primaryBtn}>
                  <Ionicons name="time-outline" size={18} color="#1C1917" />
                  <Text style={profStyles.primaryBtnTxt}>{t('profile.openAllHistory')} ({orders.length})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Preferences */}
        <View style={profStyles.section}>
          <View style={profStyles.settingsCard}>
            {/* Address */}
            <TouchableOpacity activeOpacity={0.8} onPress={openAddressList} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="location-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.deliveryAddress')}</Text>
                <Text style={profStyles.settingValue} numberOfLines={1}>
                  {defaultAddress ? formatSavedAddress(defaultAddress) : (registrationAddress || t('profile.noAddress'))}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
            {/* Favoris */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setFavVisible(true)} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="heart-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('tabs.favorites')}</Text>
                <Text style={profStyles.settingValue}>{t('favorites.manageHint', 'Vos boutiques et produits favoris')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>

            {/* Demandes de partage de liste */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => { loadShareData(); setShareRequestsVisible(true); }} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="git-network-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.listShares', 'Partage de listes')}</Text>
                <Text style={profStyles.settingValue}>{shareRequests.length > 0 ? t('counts.pendingRequests', { count: shareRequests.length }) : (t('profile.manageShares', 'Demandes reçues · utilisateurs bloqués'))}</Text>
              </View>
              {shareRequests.length > 0 && (
                <View style={{ backgroundColor: THEME.danger, borderRadius:11, minWidth:22, height:22, alignItems:'center', justifyContent:'center', paddingHorizontal:6, marginRight:6 }}>
                  <Text style={{ color:'#fff', fontWeight:'800', fontSize:12 }}>{shareRequests.length}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setLangVisible(true)} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="language-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.language')}</Text>
                <Text style={profStyles.settingValue}>
                  {LANGUAGES.find(l => l.code === i18nInstance.language)?.flag || '🌐'} {({'fr':'Français','en':'English','es':'Español','zh':'中文','ar':'العربية','de':'Deutsch','nl':'Nederlands','it':'Italiano','pt':'Português','ja':'日本語','th':'ไทย','sv':'Svenska','ru':'Русский'})[i18nInstance.language] || i18nInstance.language}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>

            {/* Currency */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setCurrencyVisible(true)} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="cash-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.currency')}</Text>
                <Text style={profStyles.settingValue}>{currency.flag} {currency.code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>

            {/* Moyens de paiement (cartes enregistrées) */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setPaymentMethodsVisible(true)} style={profStyles.settingRow}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="card-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('cart.paymentMethods', 'Moyens de paiement')}</Text>
                <Text style={profStyles.settingValue}>{t('cart.paymentMethodsHint', 'Vos cartes pour payer')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
          </View>
        </View>

        <LegalLinks />

        {/* Become a driver */}
        <View style={profStyles.section}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setDriverInfoVisible(true)} style={profStyles.driverCard}>
            <View style={profStyles.driverIcon}>
              <Ionicons name="bicycle" size={22} color="#1C1917" />
            </View>
            <View style={profStyles.driverBody}>
              <Text style={profStyles.driverTitle}>{t('profile.becomeDriver', 'Devenir livreur')}</Text>
              <Text style={profStyles.driverSub}>{t('profile.driverSubtitle', 'Livrez et gagnez un complément de revenu')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={[profStyles.section, { marginBottom: 8 }]}>
          <TouchableOpacity activeOpacity={0.85} onPress={async () => {
            // Les listes nommées n'ont aucune copie sur le compte : prévenir
            // seulement si elles contiennent des articles.
            let listesPerdues = [];
            try {
              const reg = JSON.parse((await AsyncStorage.getItem(KEY_LISTS)) || '[]');
              for (const l of (Array.isArray(reg) ? reg : [])) {
                if (!l || !l.id || l.id === DEFAULT_LIST_ID) continue;
                const r = await loadListItems(l.id, DEFAULT_LIST_ID);
                const nom = String(l.name || '').trim();
                if (nom && r.ok && r.items.length > 0) listesPerdues.push(nom);
              }
            } catch (e) { listesPerdues = []; }
            const msgDeconnexion = listesPerdues.length
              ? t('profile.logoutConfirm') + '\n\n' + t('profile.logoutListsLost', { names: listesPerdues.join(', ') })
              : t('profile.logoutConfirm');
            Alert.alert(t('profile.logoutTitle'), msgDeconnexion, [
              { text: t('profile.cancel'), style: 'cancel' },
              { text: t('profile.logoutAction'), style: 'destructive', onPress: async () => {
                if (loggingOutRef.current) return;
                loggingOutRef.current = true;
                // Les menus en attente partent d'abord (jetons encore valables) ; s'ils n'ont pas pu
                // partir (hors ligne, trop volumineux, délai), rien n'est effacé sans votre accord.
                let menusOk = false;
                try { menusOk = await flushMenusSync(); } catch (e) { menusOk = false; }
                const terminer = async () => {
                  // Logout from Marketplace API first (needs tokens)
                  try { await logoutUser({ menusFlushed: true }); } catch(e) {}
                  // Effacer TOUTES les données du compte gardées sur l'appareil
                  // (jetons, profil, listes, panier, favoris, commandes).
                  try {
                    await clearLocalUserData({ menusFlushed: true });
                    DeviceEventEmitter.emit('USER_DATA_CLEARED');
                    DeviceEventEmitter.emit('CART_COUNT_CHANGED');
                  } catch(e) {}
                  loggingOutRef.current = false;
                  if (onLogout) onLogout();
                };
                if (menusOk) { await terminer(); return; }
                Alert.alert(
                  t('profile.menusUnsavedTitle', 'Menus non sauvegardés'),
                  t('profile.menusUnsavedMsg', "Vos menus n'ont pas pu être sauvegardés sur votre compte. Les effacer de cet appareil ?"),
                  [
                    { text: t('profile.cancel', 'Annuler'), style: 'cancel', onPress: () => { loggingOutRef.current = false; } },
                    { text: t('profile.menusUnsavedErase', 'Effacer et me déconnecter'), style: 'destructive', onPress: terminer },
                  ],
                  { cancelable: false }
                );
              }}
            ]);
          }} style={profStyles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={THEME.danger} />
            <Text style={profStyles.logoutTxt}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Supprimer le compte (obligatoire App Store 5.1.1(v)) */}
        <View style={[profStyles.section, { marginBottom: 24 }]}>
          <TouchableOpacity activeOpacity={0.85} disabled={deletingAccount} onPress={() => {
            if (deletingAccountRef.current) return;
            Alert.alert(
              t('profile.deleteAccountTitle', 'Supprimer mon compte'),
              t('profile.deleteAccountConfirm', "Attention : votre compte est un compte Pearl Streets partagé. Le supprimer ici le supprime aussi sur l'app et le site Marketplace Pearl Streets (commandes, favoris, fidélité). Vos données sont conservées le temps requis par la loi puis effacées. Vous pouvez restaurer votre compte pendant 30 jours ; ensuite, la suppression est définitive."),
              [
                { text: t('profile.cancel', 'Annuler'), style: 'cancel' },
                { text: t('profile.deleteAccountAction', 'Supprimer'), style: 'destructive', onPress: async () => {
                  if (deletingAccountRef.current) return;
                  deletingAccountRef.current = true;
                  setDeletingAccount(true);
                  let res;
                  try { res = await apiDeleteAccount(); } catch (e) { res = { success: false }; }
                  deletingAccountRef.current = false;
                  setDeletingAccount(false);
                  if (!res || !res.success) {
                    Alert.alert(
                      t('profile.deleteAccountErrTitle', 'Suppression impossible'),
                      t('profile.deleteAccountErr', 'La suppression du compte a échoué. Vérifiez votre connexion et réessayez.')
                    );
                    return;
                  }
                  // Effacer toutes les données locales (comme à la déconnexion)
                  try {
                    await clearLocalUserData();
                    DeviceEventEmitter.emit('USER_DATA_CLEARED');
                    DeviceEventEmitter.emit('CART_COUNT_CHANGED');
                  } catch (e) {}
                  Alert.alert(
                    t('profile.deleteAccountDoneTitle', 'Compte supprimé'),
                    t('profile.deleteAccountDone', 'Votre compte a bien été supprimé.')
                  );
                  if (onLogout) onLogout();
                }},
              ]
            );
          }} style={profStyles.deleteAccountBtn}>
            {deletingAccount
              ? <ActivityIndicator size="small" color={THEME.danger} />
              : <Ionicons name="trash-outline" size={18} color={THEME.danger} />}
            <Text style={profStyles.deleteAccountTxt}>{t('profile.deleteAccount', 'Supprimer mon compte')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Driver Info Full Page Modal */}
      <Modal onRequestClose={() => setDriverInfoVisible(false)} visible={driverInfoVisible} animationType="slide">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setDriverInfoVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.becomeDriver', 'Devenir livreur')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:40 }} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={profStyles.driverHero}>
              <View style={profStyles.driverHeroIcon}>
                <Ionicons name="bicycle" size={36} color="#1C1917" />
              </View>
              <Text style={profStyles.driverHeroTitle}>Pearl Delivery</Text>
              <Text style={profStyles.driverHeroSub}>
                {t('profile.driverInfoDesc', 'Gagnez un complément de revenu en livrant des commandes dans votre ville.')}
              </Text>
            </View>

            {/* Two types */}
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.driverTypes', 'Deux façons de livrer')}</Text>
            </View>

            <View style={profStyles.driverTypeCard}>
              <View style={profStyles.driverTypeHead}>
                <View style={profStyles.driverTypeIcon}>
                  <Ionicons name="bicycle" size={19} color={THEME.brand} />
                </View>
                <Text style={profStyles.driverTypeTitle}>{t('profile.driverParticulier', 'Livreur Particulier')}</Text>
              </View>
              <Text style={profStyles.driverTypeTxt}>
                {t('profile.driverParticulierInfo', 'Aucun statut professionnel requis. Livrez quand vous voulez en complément de revenu, dans la limite du plafond annuel de votre pays.')}
              </Text>
            </View>

            <View style={[profStyles.driverTypeCard, { marginBottom: 18 }]}>
              <View style={profStyles.driverTypeHead}>
                <View style={profStyles.driverTypeIcon}>
                  <Ionicons name="storefront" size={19} color={THEME.brand} />
                </View>
                <Text style={profStyles.driverTypeTitle}>{t('profile.driverPro', 'Livreur Pro')}</Text>
              </View>
              <Text style={profStyles.driverTypeTxt}>
                {t('profile.driverProInfo', 'Vous avez un statut professionnel (auto-entrepreneur, société). Pas de limite de revenus. Documents requis : carte d\'identité, IBAN, Kbis.')}
              </Text>
            </View>

            {/* Country limits */}
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.driverLimits', 'Plafonds par pays (particuliers)')}</Text>
            </View>

            {[
              { flag: '🇫🇷', name: t('countries.FR', 'France'), limit: t('profile.perYear', { amount: '3 000 €', defaultValue: '3 000 €/an' }), status: 'ok', info: t('profile.limitMicroBic', 'Micro-BIC, abattement 50%') },
              { flag: '🇧🇪', name: t('countries.BE', 'Belgique'), limit: t('profile.perYear', { amount: '7 700 €', defaultValue: '7 700 €/an' }), status: 'ok', info: t('profile.limitFixedRate', 'Taux fixe 10,7%') },
              { flag: '🇬🇧', name: t('countries.GB', 'Royaume-Uni'), limit: t('profile.perYear', { amount: '1 000 £', defaultValue: '1 000 £/an' }), status: 'ok', info: t('profile.limitTradingAllowance', 'Trading Allowance') },
              { flag: '🇩🇪', name: t('countries.DE', 'Allemagne'), limit: '-', status: 'gray', info: t('profile.limitNoFramework', 'Pas de cadre spécifique') },
              { flag: '🇮🇹', name: t('countries.IT', 'Italie'), limit: '-', status: 'gray', info: t('profile.limitNoFramework', 'Pas de cadre spécifique') },
              { flag: '🇪🇸', name: t('countries.ES', 'Espagne'), limit: '-', status: 'blocked', info: t('profile.limitEmployeeRequired', 'Statut salarié obligatoire') },
              { flag: '🇨🇭', name: t('countries.CH', 'Suisse'), limit: '-', status: 'blocked', info: t('profile.limitEmployeeSince2023', 'Statut salarié depuis 2023') },
              { flag: '🇳🇱', name: t('countries.NL', 'Pays-Bas'), limit: '-', status: 'strict', info: t('profile.limitRequalification', 'Risque de requalification') },
              { flag: '🇵🇹', name: t('countries.PT', 'Portugal'), limit: '-', status: 'gray', info: t('profile.limitNoFramework', 'Pas de cadre spécifique') },
            ].map((c, i) => {
              const limitColor = c.status === 'ok' ? THEME.brand : c.status === 'blocked' ? THEME.danger : '#F59E0B';
              return (
              <View key={i} style={profStyles.limitRow}>
                <Text style={profStyles.limitFlag}>{c.flag}</Text>
                <View style={{ flex:1 }}>
                  <Text style={profStyles.limitName}>{c.name}</Text>
                  <Text style={profStyles.limitInfo}>{c.info}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={[profStyles.limitValue, { color: limitColor }]}>{c.limit}</Text>
                  <Ionicons name={c.status === 'ok' ? 'checkmark-circle' : c.status === 'blocked' ? 'close-circle' : 'alert-circle'} size={14} color={limitColor} style={{marginTop:2}} />
                </View>
              </View>
              );
            })}

            {/* CTA */}
            <View style={{ marginTop:18 }}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                const { Linking, Platform } = require('react-native');
                try {
                  const canOpen = await Linking.canOpenURL('pearl-delivery://');
                  if (canOpen) {
                    setDriverInfoVisible(false);
                    Linking.openURL('pearl-delivery://');
                  } else {
                    throw new Error('not installed');
                  }
                } catch(e) {
                  // App not installed — redirect to store
                  Alert.alert(
                    'Pearl Delivery',
                    t('profile.downloadDeliveryApp') || "L'app Pearl Delivery n'est pas installée. Téléchargez-la pour devenir livreur.",
                    [
                      { text: t('profile.cancel', 'Annuler'), style: 'cancel' },
                      { text: 'App Store', onPress: () => Linking.openURL('https://apps.apple.com/app/pearl-delivery/id6749835609') },
                      Platform.OS === 'android' ? { text: 'Google Play', onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.pearlstreets.delivery') } : null,
                    ].filter(Boolean)
                  );
                }
              }} style={profStyles.primaryBtn}>
                <Ionicons name="bicycle" size={22} color="#1C1917" />
                <Text style={profStyles.primaryBtnTxt}>{t('profile.openDeliveryApp') || "Ouvrir l'app Pearl Delivery"}</Text>
              </TouchableOpacity>
              <Text style={profStyles.legalNote}>
                {t('profile.driverLegalNote') || "L'inscription se fait directement dans l'app Pearl Delivery. Vous pouvez choisir entre livreur particulier ou professionnel."}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Full Page Modal */}
      <Modal onRequestClose={() => setEditVisible(false)} visible={editVisible} animationType="slide">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{t('profile.editProfile')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.pseudo')}</Text>
                <TextInput value={editPseudo} onChangeText={setEditPseudo} placeholder={t('profile.pseudoPlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.firstName')}</Text>
                <TextInput value={editPrenom} onChangeText={setEditPrenom} placeholder={t('profile.firstNamePlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.lastName')}</Text>
                <TextInput value={editNom} onChangeText={setEditNom} placeholder={t('profile.lastNamePlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.email')}</Text>
                <TextInput value={editEmail} onChangeText={setEditEmail} placeholder={t('profile.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none"
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              {/* Password change section */}
              {!showPwdChange ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => { setShowPwdChange(true); setPwdError(''); setPwdSuccess(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  style={profStyles.pwdToggle}>
                  <View style={profStyles.settingIcon}>
                    <Ionicons name="lock-closed-outline" size={18} color="#1C1917" />
                  </View>
                  <Text style={profStyles.pwdToggleTxt}>{t('profile.changePassword')}</Text>
                  <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
                </TouchableOpacity>
              ) : (
                <View style={profStyles.pwdPanel}>
                  <View style={profStyles.pwdPanelHead}>
                    <Ionicons name="lock-closed-outline" size={18} color={THEME.brand} />
                    <Text style={profStyles.pwdPanelTitle}>{t('profile.changePassword')}</Text>
                    <TouchableOpacity onPress={() => setShowPwdChange(false)} style={profStyles.closeBtn}>
                      <Ionicons name="close" size={18} color={THEME.muted} />
                    </TouchableOpacity>
                  </View>

                  {pwdError ? (
                    <View style={[profStyles.pwdAlert, { backgroundColor: THEME.dangerSoft }]}>
                      <Ionicons name="alert-circle" size={16} color={THEME.danger} />
                      <Text style={[profStyles.pwdAlertTxt, { color: THEME.danger }]}>{pwdError}</Text>
                    </View>
                  ) : null}
                  {pwdSuccess ? (
                    <View style={[profStyles.pwdAlert, { backgroundColor: THEME.brandSoft }]}>
                      <Ionicons name="checkmark-circle" size={16} color={THEME.brandDark} />
                      <Text style={[profStyles.pwdAlertTxt, { color: THEME.brandDark }]}>{pwdSuccess}</Text>
                    </View>
                  ) : null}

                  <View style={profStyles.fieldGroup}>
                    <Text style={profStyles.fieldLabel}>{t('profile.oldPassword')}</Text>
                    <TextInput value={oldPassword} onChangeText={setOldPassword} placeholder={t('profile.currentPasswordPlaceholder')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <View style={profStyles.fieldGroup}>
                    <Text style={profStyles.fieldLabel}>{t('profile.newPassword')}</Text>
                    <TextInput value={newPassword} onChangeText={setNewPassword} placeholder={t('profile.newPassword')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <View style={[profStyles.fieldGroup, { marginBottom: 4 }]}>
                    <Text style={profStyles.fieldLabel}>{t('profile.confirmPassword')}</Text>
                    <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('profile.confirmPassword')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <TouchableOpacity activeOpacity={0.85} onPress={handleChangePassword} style={[profStyles.primaryBtn, { marginTop: 12 }]}>
                    <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.validate')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={profStyles.btnRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setEditVisible(false)} style={[profStyles.cancelBtn, { flex: 1 }]}>
                  <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={saveProfile} style={profStyles.saveBtn}>
                  <Text style={profStyles.saveBtnTxt}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Partage de listes : demandes reçues + utilisateurs bloqués (profil connecté) */}
      <Modal visible={shareRequestsVisible} animationType="slide" onRequestClose={() => setShareRequestsVisible(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:THEME.bg }}>
          <View style={{ flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:THEME.border }}>
            <TouchableOpacity onPress={() => setShareRequestsVisible(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="arrow-back" size={24} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={{ marginLeft:12, fontSize:18, fontFamily: SERIF, fontWeight:'600', color:THEME.ink }}>{t('profile.listShares', 'Partage de listes')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:16 }}>
            <Text style={profStyles.sectionTitle}>{t('profile.pendingRequestsTitle', 'Demandes reçues')}</Text>
            {shareRequests.length === 0 && <Text style={{ color:THEME.faint, marginBottom:16 }}>{t('profile.noRequests', 'Aucune demande pour le moment.')}</Text>}
            {shareRequests.map((r) => (
              <View key={String(r.request_id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                <Ionicons name="person-circle-outline" size={34} color={THEME.brandDark} />
                <Text style={{ flex:1, marginHorizontal:10, fontWeight:'700', color:THEME.ink }} numberOfLines={1}>{r.from?.name || '-'}</Text>
                <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'accept'))} style={{ borderWidth: 1, borderColor: '#DCC9B8', backgroundColor:'#FFFFFF', borderRadius:16, paddingHorizontal:14, paddingVertical:8, marginRight:6 }}>
                  <Text style={{ color:'#1C1917', fontWeight:'700', fontSize:13 }}>{t('profile.accept', 'Accepter')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'reject'))} style={{ padding:6, marginRight:2 }}>
                  <Ionicons name="close" size={20} color={THEME.faint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (r.from?.id) runShareAction(() => blockUserById(r.from.id)); }} style={{ padding:6 }}>
                  <Ionicons name="ban-outline" size={20} color={THEME.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <Text style={[profStyles.sectionTitle, { marginTop:24 }]}>{t('profile.blockedUsers', 'Utilisateurs bloqués')}</Text>
            {blockedUsers.length === 0 && <Text style={{ color:THEME.faint }}>{t('profile.noBlocked', 'Aucun utilisateur bloqué.')}</Text>}
            {blockedUsers.map((u) => (
              <View key={String(u.id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                <Ionicons name="ban" size={22} color={THEME.danger} />
                <Text style={{ flex:1, marginHorizontal:10, color:THEME.ink }} numberOfLines={1}>{u.name || u.username}</Text>
                <TouchableOpacity onPress={() => runShareAction(() => unblockUser(u.username))} style={{ borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, borderRadius:TAILLES.rayonBouton, paddingHorizontal:14, height:TAILLES.boutonPetit, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:13 }}>{t('profile.unblock', 'Débloquer')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Language Selector Full Page Modal */}
      <Modal onRequestClose={() => { setPendingLang(null); setLangVisible(false); }} visible={langVisible} animationType="slide" onShow={() => setPendingLang(null)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => { setPendingLang(null); setLangVisible(false); }} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.language')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
            {LANGUAGES.map(lang => {
              const currentLang = i18nInstance.language || 'fr';
              const isActive = currentLang === lang.code || currentLang.startsWith(lang.code);
              const isSelected = pendingLang === lang.code || (!pendingLang && isActive);
              return (
                <TouchableOpacity key={lang.code} activeOpacity={0.8} onPress={() => setPendingLang(lang.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                  <Text style={profStyles.pickerFlag}>{lang.flag}</Text>
                  <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn, { flex:1 }]}>{lang.label}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                const lang = pendingLang || i18nInstance.language;
                definirOngletApresRechargement('profile');
                i18nInstance.changeLanguage(lang);
                await AsyncStorage.setItem('APP_LANGUAGE', lang);
                setPendingLang(null);
                setLangVisible(false);
              }} style={[profStyles.primaryBtn, !pendingLang && profStyles.primaryBtnDisabled]}>
                <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Currency Selector Full Page Modal */}
      <Modal onRequestClose={() => { setPendingCurrency(null); setCurrencyVisible(false); }} visible={currencyVisible} animationType="slide" onShow={() => setPendingCurrency(null)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => { setPendingCurrency(null); setCurrencyVisible(false); }} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.currency')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
            {CURRENCIES.map(curr => {
              const isSelected = pendingCurrency === curr.code || (!pendingCurrency && currency.code === curr.code);
              return (
                <TouchableOpacity key={curr.code} activeOpacity={0.8} onPress={() => setPendingCurrency(curr.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                  <Text style={profStyles.pickerFlag}>{curr.flag}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn]}>{t(`currencies.${curr.code}`, curr.name)}</Text>
                    <Text style={profStyles.pickerSub}>{curr.code}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => {
                const code = pendingCurrency || currency.code;
                const found = CURRENCIES.find(c => c.code === code);
                if (found) setCurrency(found);
                setPendingCurrency(null);
                setCurrencyVisible(false);
              }} style={[profStyles.primaryBtn, !pendingCurrency && profStyles.primaryBtnDisabled]}>
                <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address — saved addresses list */}
      <Modal visible={addressListVisible} animationType="slide" onRequestClose={() => setAddressListVisible(false)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setAddressListVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.deliveryAddress')}</Text>
          </View>
          {addressLoading && addresses.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={THEME.brand} size="large" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={profStyles.addrSectionTitle}>{t('profile.addrSelect', 'Select delivery address')}</Text>
              {addresses.length === 0 ? (
                <View style={profStyles.addrEmpty}>
                  <View style={profStyles.addrEmptyIcon}>
                    <Ionicons name="location-outline" size={26} color="#1C1917" />
                  </View>
                  <Text style={profStyles.addrEmptyTxt}>{t('profile.addrEmpty', 'No saved address yet')}</Text>
                </View>
              ) : addresses.map((item) => {
                const isDef = !!item.is_default;
                const isWork = item.address_type === 'work';
                const fullAddr = formatSavedAddress(item);
                const who = [item.first_name, item.last_name].filter(Boolean).join(' ');
                const phone = [item.phone_code, item.phone_number].filter(Boolean).join(' ');
                return (
                  <TouchableOpacity key={String(item.id)} activeOpacity={0.85} onPress={() => !isDef && selectDefaultAddress(item.id)} style={[profStyles.addrCard, isDef && profStyles.addrCardOn]}>
                    <View style={profStyles.addrCardHead}>
                      <View style={profStyles.addrTypeIcon}>
                        <Ionicons name={isWork ? 'briefcase' : 'home'} size={14} color="#1C1917" />
                      </View>
                      <Text style={profStyles.addrType}>{isWork ? t('profile.addrWork', 'Work') : t('profile.addrHome', 'Home')}</Text>
                      {isDef && (
                        <View style={profStyles.addrBadge}>
                          <Text style={profStyles.addrBadgeTxt}>{t('profile.addrDefault', 'Default')}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }} />
                      {isDef && (
                        <View style={profStyles.addrCheck}>
                          <Ionicons name="checkmark" size={15} color="#1C1917" />
                        </View>
                      )}
                    </View>
                    {!!(who || phone) && (
                      <Text style={profStyles.addrName} numberOfLines={1}>{[who, phone].filter(Boolean).join('  •  ')}</Text>
                    )}
                    <Text style={profStyles.addrText}>{fullAddr}</Text>
                    <View style={profStyles.addrDivider} />
                    <View style={profStyles.addrActions}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => openEditAddress(item)} style={profStyles.addrAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="create-outline" size={17} color={THEME.ink} />
                        <Text style={profStyles.addrActionTxt}>{t('profile.edit', 'Edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => confirmDeleteAddress(item.id)} style={profStyles.addrAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={17} color={THEME.danger} />
                        <Text style={[profStyles.addrActionTxt, { color: THEME.danger }]}>{t('profile.delete', 'Delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <View style={profStyles.addrFooter}>
            <TouchableOpacity activeOpacity={0.9} onPress={openAddAddress} style={profStyles.primaryBtn}>
              <Ionicons name="add" size={20} color="#1C1917" />
              <Text style={profStyles.primaryBtnTxt}>{t('profile.addrAdd', 'Add New Address')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address — add / edit form */}
      <Modal visible={addressFormVisible} animationType="slide" onRequestClose={() => setAddressFormVisible(false)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => setAddressFormVisible(false)} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{editingAddressId ? t('profile.addrEditTitle', 'Edit Address') : t('profile.addrAdd', 'Add New Address')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={0.85} onPress={addressGeo} disabled={geoLoading} style={[profStyles.geoBtn, geoLoading && { backgroundColor: THEME.subtle }]}>
                {geoLoading ? (
                  <ActivityIndicator color={THEME.brand} />
                ) : (
                  <Ionicons name="navigate" size={19} color={THEME.brandDark} />
                )}
                <Text style={profStyles.geoBtnTxt}>{geoLoading ? t('profile.locating') : t('profile.useMyLocation')}</Text>
              </TouchableOpacity>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrType', 'Address type')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[['home', 'home', t('profile.addrHome', 'Home')], ['work', 'briefcase', t('profile.addrWork', 'Work')]].map(([key, icon, label]) => {
                    const on = addrForm.address_type === key;
                    return (
                      <TouchableOpacity key={key} activeOpacity={0.8} onPress={() => setAF('address_type', key)} style={[profStyles.addrTypeBtn, on && profStyles.addrTypeBtnOn]}>
                        <Ionicons name={on ? icon : icon + '-outline'} size={17} color={on ? MARCHE.blanc : THEME.muted} />
                        <Text style={[profStyles.addrTypeBtnTxt, on && profStyles.addrTypeBtnTxtOn]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={profStyles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.firstName')}</Text>
                  <TextInput value={addrForm.first_name} onChangeText={(v) => setAF('first_name', v)} placeholder={t('profile.firstNamePlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.lastName')}</Text>
                  <TextInput value={addrForm.last_name} onChangeText={(v) => setAF('last_name', v)} placeholder={t('profile.lastNamePlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrPhone', 'Phone')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TextInput value={addrForm.phone_code} onChangeText={(v) => setAF('phone_code', v)} placeholder="+33" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[profStyles.field, { width: 88 }]} />
                  <TextInput value={addrForm.phone_number} onChangeText={(v) => setAF('phone_number', v)} placeholder="6 12 34 56 78" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[profStyles.field, { flex: 1 }]} />
                </View>
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.street')}</Text>
                <TextInput value={addrForm.house_building} onChangeText={onAddrStreetChange} placeholder={t('auth.addressAutoPlaceholder', 'Commencez à taper votre adresse…')} placeholderTextColor={THEME.faint} autoCorrect={false} style={profStyles.field} />
                {addrPhotonSuggestions.length > 0 && (
                  <View style={lstyles.suggestBox}>
                    {addrPhotonSuggestions.map((s, i) => (
                      <TouchableOpacity key={i} onPress={() => pickProfileAddress(s)} activeOpacity={0.7}
                        style={[lstyles.suggestRow, i < addrPhotonSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: THEME.border }]}>
                        <Ionicons name="location-outline" size={16} color={THEME.brandDark} style={{ marginRight: 8 }} />
                        <Text style={{ flex: 1, fontSize: 13.5, color: THEME.ink }} numberOfLines={2}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addressSupplement')}</Text>
                <TextInput value={addrForm.road_area_colony} onChangeText={(v) => setAF('road_area_colony', v)} placeholder={t('profile.supplementPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.postalCode')}</Text>
                  <TextInput value={addrForm.pincode} onChangeText={(v) => setAF('pincode', v)} placeholder={t('profile.postalCodePlaceholder')} keyboardType="number-pad" placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.city')}</Text>
                  <TextInput value={addrForm.city} onChangeText={(v) => setAF('city', v)} placeholder={t('profile.cityPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
              </View>

              <View style={[profStyles.fieldGroup, { marginBottom: 24 }]}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrState', 'State / Region')}</Text>
                <TextInput value={addrForm.state} onChangeText={(v) => setAF('state', v)} placeholder={t('profile.addrState', 'State / Region')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.btnRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setAddressFormVisible(false)} style={[profStyles.cancelBtn, { flex: 1 }]}>
                  <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={submitAddress} disabled={addrSaving} style={profStyles.saveBtn}>
                  {addrSaving ? <ActivityIndicator color="#1C1917" /> : <Text style={profStyles.saveBtnTxt}>{t('profile.save')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* All Orders Full Page Modal */}
      <Modal onRequestClose={() => setAllOrdersVisible(false)} visible={allOrdersVisible} animationType="none">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setAllOrdersVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.allOrders')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:32 + INSET_BAS }} showsVerticalScrollIndicator={false}>
            {orders.map((order) => {
              const status = getOrderStatus(order);
              return (
              <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => { setAllOrdersVisible(false); setTimeout(() => setDetailOrder(order), 300); }}
                style={profStyles.orderCard}>
                <View style={profStyles.orderRow}>
                  <View style={profStyles.orderIcon}>
                    <Ionicons name={status.icon} size={20} color={THEME.brand} />
                  </View>
                  <View style={profStyles.orderBody}>
                    <Text style={profStyles.orderTitle} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                    <View style={profStyles.orderStatusRow}>
                      <View style={[profStyles.orderDot, { backgroundColor: status.color }]} />
                      <Text style={[profStyles.orderStatusTxt, { color: status.color }]}>{status.label}</Text>
                    </View>
                    {(order.shops && order.shops.length > 0) ? (
                      <Text style={profStyles.orderShops} numberOfLines={1}>{order.shops.join(', ')}</Text>
                    ) : null}
                    <Text style={profStyles.orderDate}>{fmtDate(order.date)}</Text>
                  </View>
                  <View style={profStyles.orderSide}>
                    <View style={profStyles.modePill}>
                      <Text style={profStyles.modePillTxt}>
                        {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                      </Text>
                    </View>
                    <Text style={profStyles.orderPrice}>{fmtPrice(order.total||0)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={THEME.faint} style={{marginTop:4}} />
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Order Detail Full Page Modal */}
      <Modal onRequestClose={() => setDetailOrder(null)} visible={!!detailOrder} animationType="none">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailOrder(null)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>
              {t('profile.orderNumber')} #{detailOrder ? String(detailOrder.id).slice(-4) : ''}
            </Text>
            {detailOrder && (
              <View style={profStyles.modalHeaderPill}>
                <Text style={profStyles.modalHeaderPillTxt}>
                  {detailOrder.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                </Text>
              </View>
            )}
          </View>
          {detailOrder && (
            <ScrollView style={{flex:1}} contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:20 + INSET_BAS }} showsVerticalScrollIndicator={false}>
              {/* Infos commande */}
              <View style={[profStyles.modalCard, { marginBottom: 12 }]}>
                <View style={profStyles.detailInfoRow}>
                  <Ionicons name="calendar-outline" size={16} color={THEME.brand} />
                  <Text style={profStyles.detailInfoLabel}>{t('profile.orderedOn')}</Text>
                  <Text style={profStyles.detailInfoValue}>{fmtDate(detailOrder.date)}</Text>
                </View>
                {detailOrder.slot ? (
                  <View style={profStyles.detailInfoRow}>
                    <Ionicons name="time-outline" size={16} color={THEME.brand} />
                    <Text style={profStyles.detailInfoLabel}>{detailOrder.mode === 'collect' ? t('cart.collect') : t('cart.delivery')}</Text>
                    <Text style={profStyles.detailInfoValue}>
                      {detailOrder.deliveryDate ? cleanPickupDate(detailOrder.deliveryDate, t) + ', ' : ''}{detailOrder.slot}
                    </Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'delivery' && detailOrder.address ? (
                  <View style={profStyles.detailInfoRow}>
                    <Ionicons name="home-outline" size={16} color={THEME.brand} />
                    <Text style={profStyles.detailInfoLabel}>{t('profile.address')}</Text>
                    <Text style={[profStyles.detailInfoValue, { flex:1 }]} numberOfLines={2}>{detailOrder.address}</Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'collect' ? (
                  <View style={profStyles.detailInfoRow}>
                    <Ionicons name="storefront-outline" size={16} color={THEME.brand} />
                    <Text style={profStyles.detailInfoLabel}>{t('profile.storePickup')}</Text>
                  </View>
                ) : null}
                {/* Carte de suivi LIVE (type Uber Eats) : le livreur bouge en
                    direct, ETA recalculé, bandeau de proximité. Affichée dès qu'on
                    a une position livreur ou l'adresse client. */}
                {detailOrder.mode === 'delivery' && deliveryStatuses[detailOrder.id]
                  && (deliveryStatuses[detailOrder.id].driver_lat != null
                      || deliveryStatuses[detailOrder.id].dropoff_lat != null) ? (
                  <View style={{ marginTop: 12 }}>
                    <LiveDeliveryMap status={deliveryStatuses[detailOrder.id]} t={t} />
                  </View>
                ) : null}
                {/* Driver info (from Livraison-app) */}
                {detailOrder.mode === 'delivery' && (detailOrder.driverName || deliveryStatuses[detailOrder.id]?.driver_name) ? (
                  <View style={profStyles.driverChip}>
                    <View style={profStyles.driverChipIcon}>
                      <Ionicons name="bicycle" size={18} color="#1C1917" />
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={profStyles.driverChipName}>
                        {deliveryStatuses[detailOrder.id]?.driver_name || detailOrder.driverName}
                      </Text>
                      <Text style={profStyles.driverChipSub}>
                        {deliveryStatuses[detailOrder.id]?.estimated_arrival || detailOrder.estimatedArrival || t('orderStatus.onTheWay')}
                      </Text>
                    </View>
                    {(deliveryStatuses[detailOrder.id]?.driver_phone || detailOrder.driverPhone) ? (
                      <TouchableOpacity style={profStyles.driverChipCall}>
                        <Ionicons name="call" size={16} color="#1C1917" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                {/* Pourboire APRÈS livraison (type Uber Eats) */}
                {(() => {
                  const st = deliveryStatuses[detailOrder.id]?.status || detailOrder.deliveryStatus;
                  const delivered = st === 'delivered' || st === DELIVERY_STATUS.DELIVERED;
                  if (detailOrder.mode !== 'delivery' || !delivered) return null;
                  const tipped = Number(deliveryStatuses[detailOrder.id]?.tip_amount
                    || deliveryStatuses[detailOrder.id]?.data?.tip_amount || 0);
                  return (
                    <View style={{ marginTop: 12, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, borderWidth: 1, borderColor: THEME.border, padding: 14 }}>
                      <Text style={{ fontFamily: SERIF, fontWeight: '600', fontSize: 15, color: THEME.ink, marginBottom: 8 }}>
                        {tipped > 0
                          ? t('cart.tipThanks', 'Merci pour votre pourboire !')
                          : t('cart.tipDriver', 'Remercier votre livreur')}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[1, 2, 3, 5].map(v => (
                          <TouchableOpacity key={v} activeOpacity={0.85} disabled={tipLoading}
                            onPress={() => submitPostTip(detailOrder.id, v)}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton,
                              borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, opacity: tipLoading ? 0.5 : 1 }}>
                            <Text style={{ fontWeight: '600', color: THEME.ink }}>{fmtPrice(v)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })()}
                {/* Notation du livreur + signalement (post-livraison, type Uber Eats) */}
                {(() => {
                  const st = deliveryStatuses[detailOrder.id]?.status || detailOrder.deliveryStatus;
                  const delivered = st === 'delivered' || st === DELIVERY_STATUS.DELIVERED;
                  if (detailOrder.mode !== 'delivery' || !delivered) return null;
                  const rated = Number(deliveryStatuses[detailOrder.id]?.data?.rating || 0);
                  return (
                    <View style={{ marginTop: 12, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, borderWidth: 1, borderColor: THEME.border, padding: 14 }}>
                      <Text style={{ fontFamily: SERIF, fontWeight: '600', fontSize: 15, color: THEME.ink, marginBottom: 8 }}>
                        {rated > 0 ? t('rating.yourRating', 'Votre note') : t('rating.rateDriver', 'Noter votre livreur')}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[1, 2, 3, 4, 5].map(v => (
                          <TouchableOpacity key={v} activeOpacity={0.8} disabled={rated > 0} onPress={() => submitRating(detailOrder.id, v)}>
                            <Ionicons name={v <= rated ? 'star' : 'star-outline'} size={28} color={v <= rated ? '#f5a623' : '#ccc'} />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity activeOpacity={0.8} onPress={() => submitReport(detailOrder.id)}
                        style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="alert-circle-outline" size={18} color="#e74c3c" />
                        <Text style={{ color: '#e74c3c', fontWeight: '700', fontSize: 14 }}>{t('report.title', 'Signaler un problème')}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
                {/* Réponse au signalement (plainte traitée par le support) */}
                {(() => {
                  const plainte = deliveryStatuses[detailOrder.id]?.plainte;
                  if (!plainte || (plainte.status !== 'resolved' && plainte.status !== 'rejected')) return null;
                  const note = String(plainte.resolution_note || '').trim();
                  return (
                    <View style={{ marginTop: 12, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, borderWidth: 1, borderColor: THEME.border, padding: 14 }}>
                      <Text style={{ fontFamily: SERIF, fontWeight: '600', fontSize: 15, color: THEME.ink, marginBottom: 8 }}>
                        {t('report.answerTitle')}
                      </Text>
                      <Text style={{ fontSize: 14, color: THEME.muted }}>{note || t('report.handled')}</Text>
                    </View>
                  );
                })()}
                {/* Code livreur : à communiquer au livreur pour valider la remise */}
                {(() => {
                  const code = deliveryStatuses[detailOrder.id]?.delivery_code || detailOrder.deliveryCode;
                  const st = deliveryStatuses[detailOrder.id]?.status || detailOrder.deliveryStatus;
                  if (detailOrder.mode !== 'delivery' || !code
                      || st === DELIVERY_STATUS.DELIVERED || st === DELIVERY_STATUS.CANCELLED) return null;
                  return (
                    <View style={{ marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 12,
                      backgroundColor: '#EAF9F3', borderWidth: 1, borderColor: '#62D4AC', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#0B7A5B', fontWeight: '600' }}>
                        {t('orderStatus.deliveryCode', 'Code à donner au livreur')}
                      </Text>
                      <Text style={{ fontSize: 26, letterSpacing: 6, fontWeight: '800', color: '#0B7A5B', marginTop: 4 }}>
                        {code}
                      </Text>
                    </View>
                  );
                })()}
                {/* Coûts */}
                <View style={profStyles.costBlock}>
                  <View style={profStyles.costRow}>
                    <Text style={profStyles.costLabel}>{t('profile.subtotal')}</Text>
                    <Text style={profStyles.costValue}>{fmtPrice(detailOrder.subtotal != null ? detailOrder.subtotal : (detailOrder.total||0) - (detailOrder.deliveryFee||0))}</Text>
                  </View>
                  <View style={profStyles.costRow}>
                    <Text style={profStyles.costLabel}>{detailOrder.mode === 'delivery' ? t('profile.deliveryFee') : t('profile.collectFee')}</Text>
                    <Text style={(detailOrder.deliveryFee||0) === 0 ? profStyles.costValueFree : profStyles.costValue}>
                      {(detailOrder.deliveryFee||0) === 0 ? t('cart.free') : fmtPrice(detailOrder.deliveryFee||0)}
                    </Text>
                  </View>
                  <View style={profStyles.grandRow}>
                    <Text style={profStyles.grandLabel}>{t('cart.total')}</Text>
                    <Text style={profStyles.grandValue}>{fmtPrice(detailOrder.total||0)}</Text>
                  </View>
                </View>
              </View>

              {/* Statut actuel */}
              {(() => {
                const status = getOrderStatus(detailOrder);
                return (
                  <View style={profStyles.statusCard}>
                    <View style={[profStyles.statusCardIcon, { backgroundColor: status.color + '20' }]}>
                      <Ionicons name={status.icon} size={20} color={status.color} />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={profStyles.statusCardLabel}>{t('profile.orderTracking')}</Text>
                      <Text style={[profStyles.statusCardValue, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Annuler la commande : livraison encore en attente seulement ;
                  le serveur a le dernier mot (messages neutres). */}
              {(() => {
                const etat = annulation[detailOrder.id];
                const bouton = etat !== 'done' && etat !== 'tooLate'
                  && annulationPossible(detailOrder, deliveryStatuses[detailOrder.id]);
                const msg = etat === 'done' ? t('cancel.done', 'Commande annulée, remboursement en cours.')
                  : etat === 'tooLate' ? t('cancel.tooLate', 'Votre commande est déjà en préparation, elle ne peut plus être annulée.')
                  : etat === 'failed' ? t('cancel.failed', "L'annulation n'a pas abouti. Réessayez dans un instant.")
                  : '';
                if (!bouton && !msg) return null;
                return (
                  <View style={profStyles.cancelWrap}>
                    {msg ? <Text style={profStyles.cancelMsg}>{msg}</Text> : null}
                    {bouton ? (
                      <TouchableOpacity activeOpacity={0.85} disabled={etat === 'busy'}
                        onPress={() => annulerCommande(detailOrder.id)} style={profStyles.cancelBtn}
                        accessibilityRole="button" accessibilityLabel={t('cancel.button', 'Annuler la commande')}>
                        {etat === 'busy' ? <ActivityIndicator color={THEME.danger} /> : (
                          <Text style={profStyles.cancelBtnTxt}>{t('cancel.button', 'Annuler la commande')}</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })()}

              {/* Produits par shop */}
              <View style={[profStyles.sectionHeadRow, { marginTop: 6 }]}>
                <Text style={profStyles.sectionTitle}>{t('profile.productDetails')}</Text>
              </View>
              {(() => {
                const byShop = {};
                (detailOrder.items||[]).forEach(it => {
                  const s = it.shop || '__other__';
                  if (!byShop[s]) byShop[s] = [];
                  byShop[s].push(it);
                });
                return Object.entries(byShop).map(([shop, items]) => (
                  <View key={shop} style={profStyles.shopBlock}>
                    <View style={profStyles.shopBlockHead}>
                      <View style={profStyles.shopBlockIcon}>
                        <Ionicons name="storefront-outline" size={17} color={THEME.brand} />
                      </View>
                      <Text style={profStyles.shopBlockName}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                    </View>
                    {items.map((it, idx) => (
                      <View key={idx} style={[profStyles.detailItemRow, idx > 0 && profStyles.detailItemDivider]}>
                        <ProductThumb name={it.name||it.title} size={36} />
                        <View style={profStyles.detailItemBody}>
                          <Text style={profStyles.detailItemName} numberOfLines={1}>{it.name||it.title}</Text>
                          <Text style={profStyles.detailItemMeta}>{t('cart.qty')}: {it.qty||1} × {fmtPrice((it.price||0))}</Text>
                        </View>
                        <Text style={profStyles.detailItemPrice}>
                          {fmtPrice((it.price||0)*(it.qty||1))}
                        </Text>
                      </View>
                    ))}
                  </View>
                ));
              })()}

            </ScrollView>
          )}

          {/* Bouton recommander fixe en bas */}
          {detailOrder && (
            <View style={profStyles.detailFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  const items = (detailOrder.items||[]).map((it, i) => ({
                    id: i,
                    name: it.name || it.title,
                    detail: it.detail || '',
                    unitPrice: it.unitPrice || '',
                    qty: it.qty || 1,
                    price: it.price || 0,
                    shop: it.shop || '',
                    // Vraie fiche gardée par l'historique (articles du panier commandés).
                    ...champsCommande(it),
                    selected: true,
                  }));
                  setReorderItems(items);
                  setReorderVisible(true);
                }}
                style={profStyles.primaryBtn}
              >
                <Ionicons name="cart-outline" size={20} color="#1C1917" />
                <Text style={profStyles.primaryBtnTxt}>{t('profile.reorder', 'Recommander')}</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </Modal>

      {/* Modal sélection recommander — AU MÊME NIVEAU */}
      <Modal onRequestClose={() => setReorderVisible(false)} visible={reorderVisible} animationType="slide" transparent={true}>
        <View style={profStyles.sheetBackdrop}>
          <View style={profStyles.sheet}>
            <View style={profStyles.sheetGrabber} />
            <View style={profStyles.sheetHeader}>
              <Text style={profStyles.sheetTitle}>{t('profile.reorder', 'Recommander')}</Text>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                <TouchableOpacity onPress={() => {
                  const allSelected = reorderItems.every(it => it.selected);
                  setReorderItems(prev => prev.map(it => ({...it, selected: !allSelected})));
                }} style={profStyles.selectAllPill}>
                  <Text style={profStyles.selectAllTxt}>{reorderItems.every(it => it.selected) ? t('listScreen.deselectAll') : t('listScreen.selectAll')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setReorderVisible(false)} style={profStyles.closeBtn}>
                  <Ionicons name="close" size={18} color={THEME.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={reorderItems}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{paddingHorizontal:20, paddingTop:4, paddingBottom:12}}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setReorderItems(prev => prev.map(it => it.id === item.id ? {...it, selected: !it.selected} : it))}
                  style={[profStyles.reorderRow, item.selected && profStyles.reorderRowOn]}
                >
                  <Square value={item.selected} onPress={() => setReorderItems(prev => prev.map(it => it.id === item.id ? {...it, selected: !it.selected} : it))} />
                  <View style={{width:10}} />
                  <ProductThumb name={item.name} size={40} />
                  <View style={profStyles.reorderBody}>
                    <Text style={profStyles.reorderName}>{item.name}</Text>
                    {item.shop ? <Text style={profStyles.reorderShop}>{item.shop}</Text> : null}
                  </View>
                  <View style={profStyles.reorderSide}>
                    <Text style={profStyles.reorderQty}>x{item.qty||1}</Text>
                    <Text style={profStyles.reorderPrice}>{fmtPrice((item.price||0)*(item.qty||1))}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <View style={profStyles.reorderTotalRow}>
              <Text style={profStyles.reorderTotalLabel}>{t('cart.total') + ' ' + t('cart.totalPrice', {defaultValue: 'prix'})}</Text>
              <Text style={profStyles.reorderTotalValue}>{fmtPrice(reorderItems.filter(it => it.selected).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||1)), 0))}</Text>
            </View>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={async () => {
                  const selected = reorderItems.filter(it => it.selected).map(it => ({
                    name: it.name, detail: it.detail, unitPrice: it.unitPrice,
                    qty: it.qty, price: it.price, shop: it.shop,
                    ...champsCommande(it),
                  }));
                  if (!selected.length) return;
                  // Panier existant GARDÉ : les articles recommandés s'y ajoutent.
                  let existant = [];
                  try { const rawC = await AsyncStorage.getItem(KEY_CART); const luC = rawC ? JSON.parse(rawC) : []; if (Array.isArray(luC)) existant = luC; } catch (e) {}
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(ajouterAuPanier(existant, selected)));
                  DeviceEventEmitter.emit('CART_UPDATED');
                  // Close everything at once and navigate
                  setReorderVisible(false);
                  setDetailOrder(null);
                  setAllOrdersVisible(false);
                  navigation.navigate('cart');
                }}
                disabled={!reorderItems.some(it => it.selected)}
                style={[profStyles.primaryBtn, !reorderItems.some(it => it.selected) && profStyles.primaryBtnDisabled]}
              >
                <Ionicons name="cart-outline" size={20} color="#1C1917" />
                <Text style={profStyles.primaryBtnTxt}>{t('cart.addToCart', 'Ajouter au panier')} ({reorderItems.filter(it => it.selected).reduce((s, it) => s + (it.qty||1), 0)})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReorderVisible(false)} style={[profStyles.cancelBtn, { marginTop: 10 }]}>
                <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
