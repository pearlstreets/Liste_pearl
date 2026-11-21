import React from "react";
import { refusAnnulation } from "../../../lib/annulation";
import { getMarketplaceOrderStatuses } from "../../../services/orders";
import { cancelDelivery, getDeliveryStatus, addDeliveryTip, reportDeliveryProblem, rateDelivery, DELIVERY_STATUS, getDeliveryStatusInfo } from "../../../services/delivery";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEY_ORDER_HISTORY } from "../../../lib/constants";

export const fmtDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch(e) { return iso; }
};

// Nettoie un libelle de retrait stocke ("Aujourd'hui 13 juil", fige a l'achat) : retire le mot relatif perime.
export function cleanPickupDate(label, t) {
  if (!label) return '';
  let s = String(label).trim();
  for (const key of ['cart.today', 'cart.tomorrow']) {
    const w = t(key);
    if (w && s.toLowerCase().startsWith((w + ' ').toLowerCase())) { s = s.slice(w.length + 1).trim(); break; }
  }
  return s;
}

// Historique des commandes de l'appareil, statuts réels et suivi livraison
// (relevé toutes les 30 s, et toutes les 5 s quand le détail est ouvert).
export function useCommandes(t) {
  const [orders, setOrders] = React.useState([]);
  const [allOrdersVisible, setAllOrdersVisible] = React.useState(false);
  const [detailOrder, setDetailOrder] = React.useState(null);
  const [reorderVisible, setReorderVisible] = React.useState(false);
  const [reorderItems, setReorderItems] = React.useState([]); // [{...item, selected: true/false}]
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
  // Track delivery status from API for delivery orders
  const [deliveryStatuses, setDeliveryStatuses] = React.useState({});

  // Poll delivery status for recent delivery orders. Les commandes sont lues
  // dans une ref : relire l'historique (focus, segment, commande passée) ne
  // relance pas une salve d'appels, seul le cycle de 30 s interroge l'API.
  const ordersRef = React.useRef(orders);
  ordersRef.current = orders;
  const aDesCommandes = orders.length > 0;
  React.useEffect(() => {
    let mounted = true;
    const pollDeliveryStatuses = async () => {
      const recentDeliveryOrders = ordersRef.current.filter(o => o.mode === 'delivery' && o.deliveryStatus && o.deliveryStatus !== DELIVERY_STATUS.DELIVERED && o.deliveryStatus !== DELIVERY_STATUS.CANCELLED);
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
    if (aDesCommandes) {
      pollDeliveryStatuses();
      const interval = setInterval(pollDeliveryStatuses, 30000); // Poll every 30s
      return () => { mounted = false; clearInterval(interval); };
    }
    return () => { mounted = false; };
  }, [aDesCommandes]);

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
  return { orders, setOrders, allOrdersVisible, setAllOrdersVisible, detailOrder, setDetailOrder, reorderVisible, setReorderVisible, reorderItems, setReorderItems, marketplaceStatuses, setMarketplaceStatuses, loadOrders, deliveryStatuses, setDeliveryStatuses, tipLoading, setTipLoading, submitPostTip, submitRating, submitReport, annulation, setAnnulation, majCommandeLocale, annulerCommande, getOrderStatus };
}
