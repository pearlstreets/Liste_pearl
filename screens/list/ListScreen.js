import React, { useEffect, useMemo, useState } from "react";
import { getSharedWithMe, syncMyList, getMyList, sendShareRequest, revokeShare, searchUsers, getGrantedShares, getPublicProfile } from "../../services/sharedLists";
import { getTokens } from "../../services/api";
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter } from 'react-native';
import Modal from '../../components/DeuxEcrans';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Keyboard, Pressable, Alert, ActivityIndicator, Image, ScrollView, Platform, KeyboardAvoidingView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReorderableList from "react-native-reorderable-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { loadListItems, persistActiveItems } from "../../lib/listStore";
import { listItemPack } from "../../lib/menus/shopping";
import { openCamera } from "../../utils/openCamera";
import RepeatButton from "../../components/ui/RepeatButton";
import { MARCHE, TAILLES } from "../../components/ui/marche";
import { parseMulti } from "../../lib/parseMulti";
import { THEME } from "../../components/commun/theme";
import { lstyles } from "../../components/commun/lstyles";
import { QtyInput } from "../../components/commun/QtyInput";
import { DragWrap } from "../../components/commun/DragWrap";
import { KEY_ITEMS, KEY_LISTS, KEY_ACTIVE_LIST, DEFAULT_LIST_ID, listItemsKey, KEY_SELECTED } from "../../lib/constants";
import { EVENEMENT_PARTAGE, prendrePartageAOuvrir } from "../../services/pushToucher";
import { useDemandesPartage, DemandesPartageModale } from "./DemandesPartage";
import { allerA } from '../../app/onglets';

export default function ListScreen() {
  const { t, i18n: i18nListe } = useTranslation();
  // Conditionnement des articles venus de Menus (« 1 tête », « 1 kg »), dans la langue de l'application.
  const langueListe = i18nListe.language;
  const optsPaquet = useMemo(() => ({
    lang: langueListe,
    labels: { g: t('menus.units.g'), kg: t('menus.units.kg'), ml: t('menus.units.ml'), l: t('menus.units.l'), u: t('menus.units.u') },
  }), [t, langueListe]);
  const tMenus = React.useCallback((k, o) => t('menus.' + k, o), [t]);
  const navigation = useNavigation();
  // Liste demandée par l'onglet Menus (navigate('myList', { listId, n })) : ouverte
  // une seule fois par demande (n), au chargement ou au retour sur l'onglet.
  const route = useRoute();
  const listeDemandee = route && route.params ? route.params.listId : undefined;
  const listeDemandeeN = route && route.params ? route.params.n : undefined;
  const demandeListeRef = React.useRef(null);
  demandeListeRef.current = listeDemandee != null && listeDemandeeN != null ? { id: String(listeDemandee), n: listeDemandeeN } : null;
  const demandeListeTraiteeRef = React.useRef(null);
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [, setSelectAll] = useState(false);
  const [, setStrikeAll] = useState(false);
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
  // Demandes de partage reçues + utilisateurs bloqués (fenêtre « Partage de listes »).
  const partage = useDemandesPartage(t);
  const { shareRequests, setShareRequestsVisible, loadShareData } = partage;
  // Demande de partage (push ou lien pearl-list://partage, services/pushToucher.js) :
  // fenêtre « Partage de listes », rechargée. iOS n'empile pas deux Modal : une
  // autre fenêtre de Ma Liste ouverte est fermée d'abord, la suivante vient 300 ms après.
  const autreModaleListe = React.useRef(false);
  const fermerModalesListe = React.useRef(() => {});
  const ouvrirPartageDepuisPush = React.useCallback(() => {
    if (!prendrePartageAOuvrir()) return;
    loadShareData();
    if (autreModaleListe.current) {
      fermerModalesListe.current();
      setTimeout(() => setShareRequestsVisible(true), 300);
    } else {
      setShareRequestsVisible(true);
    }
  }, [loadShareData]);
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVENEMENT_PARTAGE, () => { ouvrirPartageDepuisPush(); });
    return () => sub.remove();
  }, [ouvrirPartageDepuisPush]);
  // Ligne « Demandes de partage » du Profil (EVT_OUVRIR_DEMANDES_PARTAGE).
  // Ouverte depuis le Profil : sa fermeture ramène au Profil.
  const depuisProfilRef = React.useRef(false);
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OUVRIR_DEMANDES_PARTAGE', () => {
      depuisProfilRef.current = true;
      loadShareData();
      if (autreModaleListe.current) {
        fermerModalesListe.current();
        setTimeout(() => setShareRequestsVisible(true), 300);
      } else {
        setShareRequestsVisible(true);
      }
    });
    return () => sub.remove();
  }, [loadShareData]);
  // L'onglet peut ne pas être monté quand l'évènement part : la demande est
  // aussi prise au focus, avec le compteur des demandes rechargé.
  useFocusEffect(React.useCallback(() => {
    loadShareData();
    ouvrirPartageDepuisPush();
  }, [loadShareData, ouvrirPartageDepuisPush]));
  const shareDebounce = React.useRef(null);
  const shareCache = React.useRef(new Map()); // requête -> résultats (affichage instantané)
  const shareReqId = React.useRef(0);         // ignore les réponses réseau périmées

  // --- Multi-listes (MES listes) ---
  const [myLists, setMyLists] = useState([{ id: DEFAULT_LIST_ID, name: '' }]);
  const [activeListId, setActiveListId] = useState(DEFAULT_LIST_ID);
  const activeListIdRef = React.useRef(activeListId);
  activeListIdRef.current = activeListId;
  const viewingShareIdRef = React.useRef(viewingShareId);
  viewingShareIdRef.current = viewingShareId;
  const myListsRef = React.useRef(myLists);
  myListsRef.current = myLists;
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
  // Fenêtres de Ma Liste ouvertes (lu par ouvrirPartageDepuisPush).
  autreModaleListe.current = switcherOpen || shareModalOpen || grantedOpen || createListOpen || renameOpen || editVisible || unitPickerId !== null;
  fermerModalesListe.current = () => {
    setSwitcherOpen(false); setShareModalOpen(false); setGrantedOpen(false); setProfilPartage(null);
    setCreateListOpen(false); setRenameOpen(false); setUnitPickerId(null);
    setEditVisible(false); setEditId(null); setEditText("");
  };
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

  // Fenêtre « Partage de listes » refermée : une liste acceptée apparaît tout de suite.
  const demandesOuvertes = partage.shareRequestsVisible;
  const demandesOuvertesAvant = React.useRef(demandesOuvertes);
  useEffect(() => {
    const etaitOuverte = demandesOuvertesAvant.current;
    demandesOuvertesAvant.current = demandesOuvertes;
    if (!etaitOuverte || demandesOuvertes || !isLoggedIn) return;
    let alive = true;
    (async () => {
      try {
        const res = await getSharedWithMe();
        if (alive && res && res.status) setSharedLists(res.data?.lists || []);
      } catch {}
    })();
    return () => { alive = false; };
  }, [demandesOuvertes, isLoggedIn]);
  const demandesOuvertesPourProfil = React.useRef(demandesOuvertes);
  useEffect(() => {
    const etaitOuverte = demandesOuvertesPourProfil.current;
    demandesOuvertesPourProfil.current = demandesOuvertes;
    if (!etaitOuverte || demandesOuvertes || !depuisProfilRef.current) return;
    depuisProfilRef.current = false;
    allerA(navigation, 'profile');
  }, [demandesOuvertes, navigation]);

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
      const dem = demandeListeRef.current;
      let bascule = false;
      if (dem && dem.n !== demandeListeTraiteeRef.current) {
        demandeListeTraiteeRef.current = dem.n;
        if (dem.id !== active && lists.some(l => l.id === dem.id)) {
          // L'ancienne active est d'abord lue (migration de SG_ITEMS vers sa clé)
          // avant que le miroir ne prenne la liste demandée.
          const ancienne = await loadListItems(active, active);
          if (ancienne.ok) {
            active = dem.id;
            bascule = true;
            await AsyncStorage.setItem(KEY_ACTIVE_LIST, active);
          }
        }
      }
      setActiveListId(active);
      // Articles de la liste active — KEY_ITEMS reste le miroir de l'active (compat panier)
      const { ok, items: parsed } = await loadListItems(active, active);
      // Liste illisible : rien n'est affiché ni écrit par-dessus (hydrated reste faux).
      lisible = ok;
      if (ok && (bascule || !externalReload.current)) setItems(parsed);
      if (ok && (bascule || !externalReload.current)) await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify(parsed));
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
    const dem = demandeListeRef.current;
    if (dem && dem.n !== demandeListeTraiteeRef.current) {
      // Premier chargement en cours : il ouvre lui-même la liste demandée.
      if (!hydrated.current) return;
      demandeListeTraiteeRef.current = dem.n;
      const autre = dem.id !== activeListIdRef.current || viewingShareIdRef.current != null;
      if (autre && myListsRef.current.some(l => l.id === dem.id)) {
        switchOwnListRef.current(dem.id);
        return;
      }
    }
    (async () => {
      try {
        const s = await AsyncStorage.getItem("SG_ITEMS");
        if (s) { const v = JSON.parse(s); if (Array.isArray(v)) setItems(v); }
      } catch {}
    })();
  }, []));

  const addFromInput = (garderClavier) => {
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
    if (!garderClavier) Keyboard.dismiss();
  };

  const onMinus = id => setItems(items.map(it => it.id === id ? { ...it, qty: Math.max(1, (it.qty || 1) - 1) } : it));
  const onPlus  = id => setItems(items.map(it => it.id === id ? { ...it, qty: (it.qty || 1) + 1 } : it));
  const setQty  = (id, q) => setItems(items.map(it => it.id === id ? { ...it, qty: q } : it));
  const setUnit = (id, u) => setItems(items.map(it => it.id === id ? { ...it, unit: u } : it));
  const toggleSelected = id => setItems(items.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleCrossed  = id => setItems(items.map(it => it.id === id ? { ...it, crossed: !it.crossed, selected: it.crossed ? it.selected : false } : it));

  const toggleSelectAll = () => {
    const v = !toutCoche; setSelectAll(v);
    setItems(items.map(it => it.crossed ? it : { ...it, selected: v }));
  };
  const toggleStrikeAll = () => {
    const v = !toutBarre; setStrikeAll(v);
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
  // États des pastilles calculés sur les articles (et non un état local).
  const toutCoche = activeItems.length > 0 && activeItems.every(i => i.selected);
  const toutBarre = sourceItems.length > 0 && sourceItems.every(i => i && i.crossed);

  const openEdit = (it) => { setEditId(it.id); setEditText(it.name); setEditVisible(true); };
  const closeEdit = () => { setEditVisible(false); setEditId(null); setEditText(""); };
  const saveEdit = () => {
    if (!editText.trim()) { closeEdit(); return; }
    setItems(prev => prev.map(it => it.id === editId ? { ...it, name: editText.trim() } : it));
    closeEdit();
  };
  // « Supprimer cet article » depuis « Modifier l'article », après confirmation.
  const deleteEditedItem = () => {
    const id = editId;
    if (id == null) return;
    Alert.alert(
      t('listScreen.deleteThisItem'),
      t('listScreen.deleteThisItemConfirm'),
      [
        { text: t('listScreen.cancel'), style: 'cancel' },
        { text: t('listScreen.delete'), style: 'destructive', onPress: () => {
          setItems(prev => prev.filter(it => it.id !== id));
          closeEdit();
        }},
      ]
    );
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

  const switchOwnListRef = React.useRef(switchOwnList);
  switchOwnListRef.current = switchOwnList;

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
      <TouchableOpacity onPress={() => !isCrossed && toggleSelected(item.id)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}
        accessibilityRole="checkbox" accessibilityState={{ checked: !!(item.selected && !isCrossed) }} accessibilityLabel={paquet.name}>
        <View style={[lstyles.check, item.selected && !isCrossed && lstyles.checkOn]}>
          {item.selected && !isCrossed ? <Ionicons name="checkmark" size={15} color={MARCHE.blanc} /> : null}
        </View>
      </TouchableOpacity>

      {/* Name — tap to edit, appui long pour déplacer la ligne */}
      <TouchableOpacity onPress={() => openEdit(item)} onLongPress={drag} delayLongPress={220} activeOpacity={0.7} style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
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
      <TouchableOpacity onPress={() => toggleCrossed(item.id)} activeOpacity={0.7} style={{ marginLeft: 10 }}
        accessibilityRole="checkbox" accessibilityState={{ checked: !!isCrossed }} accessibilityLabel={t('listScreen.markBought', 'Marquer comme acheté')}>
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

        <View style={{ flexDirection:'row', alignItems:'center' }}>
        {/* Demandes de partage reçues et utilisateurs bloqués (connecté) : pastille rouge du nombre de demandes. */}
        {!readOnly && isLoggedIn && (
          <TouchableOpacity onPress={() => { loadShareData(); setShareRequestsVisible(true); }} activeOpacity={0.8}
            accessibilityRole="button" accessibilityLabel={shareRequests.length > 0 ? `${t('profile.listShares')}, ${t('counts.pendingRequests', { count: shareRequests.length })}` : t('profile.listShares')}
            style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.border, borderRadius:TAILLES.boutonPetit / 2, paddingHorizontal:12, height:TAILLES.boutonPetit, marginLeft:10 }}>
            <Ionicons name="mail-outline" size={16} color={THEME.brandDark} />
            {shareRequests.length > 0 && (
              <View style={{ backgroundColor: THEME.danger, borderRadius:10, minWidth:20, height:20, alignItems:'center', justifyContent:'center', paddingHorizontal:5, marginLeft:6 }}>
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:11.5 }}>{shareRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
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
          blurOnSubmit={false}
          onSubmitEditing={() => addFromInput(true)}
        />
        <TouchableOpacity onPress={() => addFromInput(false)} activeOpacity={0.85} style={lstyles.addBtn}>
          <Ionicons name="add" size={26} color="#1C1917" />
        </TouchableOpacity>
      </View>

      {items.length > 0 && (
      <View style={lstyles.toolRow}>
        <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.8} style={[lstyles.pill, toutCoche && lstyles.pillOn]}>
          <Text style={[lstyles.pillTxt, toutCoche && lstyles.pillTxtOn]}>{t(toutCoche ? 'listScreen.deselectAll' : 'listScreen.selectAll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleStrikeAll} activeOpacity={0.8} style={[lstyles.pill, toutBarre && lstyles.pillOnDark]}>
          <Text style={[lstyles.pillTxt, toutBarre && lstyles.pillTxtOn]}>{t('listScreen.strikeAll')}</Text>
        </TouchableOpacity>
        {items.some(it => it.selected && !it.crossed) && (
          <TouchableOpacity onPress={() => {
            const count = items.filter(it => it.selected && !it.crossed).length;
            Alert.alert(t('listScreen.deleteTitle'), `${t('listScreen.deleteConfirm')} ${t('counts.listSelected', { count })}`, [
              { text: t('listScreen.cancel'), style: 'cancel' },
              { text: t('listScreen.delete'), style: 'destructive', onPress: () => {
                setItems(prev => prev.filter(it => !(it.selected && !it.crossed)));
                setSelectAll(false);
              }}
            ]);
          }} activeOpacity={0.8} style={lstyles.delPill}>
            <Ionicons name="trash-outline" size={15} color={THEME.danger} />
            <Text style={lstyles.delTxt}>{items.filter(it => it.selected && !it.crossed).length}</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
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
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          sourceItems.length === 0 ? (
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
          style={[lstyles.hideRow, itemsToSend.length > 0 && lstyles.hideRowAvecBouton]}
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
        accessibilityRole="button" accessibilityLabel={`${t('listScreen.compareMyList')} (${itemsToSend.length})`} onPress={async ()=>{
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
        allerA(navigation, 'products');
      }}>
          <Ionicons name="bag-check-outline" size={20} color="#1C1917" />
          <Text style={lstyles.ctaTxt}>{t('listScreen.compareMyList')} ({itemsToSend.length})</Text>
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
        <KeyboardAvoidingView behavior="padding" style={lstyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModalOpen(false)} />
          <View style={lstyles.modalBox}>
            <Text style={lstyles.modalTitle}>{t('listScreen.shareTitle', 'Partager ma liste')}</Text>
            <Text style={{ color:THEME.faint, marginBottom:12 }}>{t('listScreen.shareHint', 'Email ou pseudo de la personne. Elle recevra une demande à accepter.')}</Text>
            {!isLoggedIn && (
              <TouchableOpacity activeOpacity={0.8} accessibilityRole="button"
                onPress={() => { setShareModalOpen(false); setTimeout(() => DeviceEventEmitter.emit('OPEN_AUTH'), 350); }}
                style={{ flexDirection:'row', alignItems:'center', backgroundColor:THEME.brandSoft, borderRadius:12, padding:10, marginBottom:10 }}>
                <Ionicons name="information-circle-outline" size={18} color={THEME.brandDark} style={{ marginRight:8 }} />
                <Text style={{ flex:1, fontSize:12.5, color:THEME.brandDark, fontWeight:'600' }}>
                  {t('listScreen.shareNeedsLogin', 'Connectez-vous pour pouvoir envoyer une demande de partage.')} {t('auth.loginBtn')}
                </Text>
              </TouchableOpacity>
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
        </KeyboardAvoidingView>
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
            <Pressable onPress={deleteEditedItem} accessibilityRole="button"
              style={{ marginTop:10, height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:THEME.card, borderWidth:1, borderColor:THEME.borderInput }}>
              <Ionicons name="trash-outline" size={16} color={THEME.danger} />
              <Text style={{ marginLeft:6, color:THEME.danger, fontWeight:'700', fontSize:14 }}>{t('listScreen.deleteThisItem')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Partage de listes : demandes reçues (Accepter, Refuser, Bloquer) et utilisateurs bloqués (Débloquer). */}
      <DemandesPartageModale t={t} partage={partage} />
    </SafeAreaView>
    </KeyboardAvoidingView>
    </View>
  );
}
