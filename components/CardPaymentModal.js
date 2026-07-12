// Écran de paiement (Option A) — sélecteur : cartes enregistrées + nouvelle carte.
// Miroir du flux prod d'AppUser :
//  - carte enregistrée → payOrderApi(payment_method_id = carte.stripe_payment_method_id)
//    (aucune saisie ; le SDK natif n'est requis que pour la reprise 3DS) ;
//  - nouvelle carte → CardField → createPaymentMethod (SDK natif) → payOrderApi.
// Puis reprise 3DS via handleNextAction, réconciliation is_paid côté serveur/webhook.
// Tout Stripe passe par services/stripeNative.js (guarded require) → aucun crash Expo Go.
import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STRIPE_PUBLISHABLE_KEY } from '../services/config';
import { StripeAvailable, StripeProvider, useStripe, CardField } from '../services/stripeNative';
import { createStripeCustomerApi, payOrderApi, getSavedCardsApi } from '../services/payment';

const BRAND = '#09d7aa';
const NEW_CARD = '__new__';

// Finalise une charge dont le PaymentIntent a été créé+confirmé côté serveur.
// Copie de AppUser Payment/index.js:186-233 (reprise 3DS + branches succeeded/échec).
async function finalisePaymentIntent(data, handleNextAction) {
  const status = data?.status;
  const clientSecret = data?.client_secret;
  const requiresAction =
    data?.requires_action || status === 'requires_action' || status === 'requires_source_action';
  if (requiresAction && clientSecret) {
    if (typeof handleNextAction !== 'function') return false;
    const { paymentIntent, error } = await handleNextAction(clientSecret);
    if (error) return false;
    return paymentIntent?.status === 'succeeded';
  }
  if (status === 'succeeded') return true;
  return false;
}

// DESCENDANT de <StripeProvider> → useStripe() garanti initialisé.
function CardPaymentInner({ orders, totalLabel, t, onSuccess, onCancel }) {
  const tr = (k, fb) => (typeof t === 'function' ? t(k, fb) : fb);
  const stripe = useStripe() || {};
  const [savedCards, setSavedCards] = React.useState([]);
  const [cardsLoading, setCardsLoading] = React.useState(true);
  const [selectedCardId, setSelectedCardId] = React.useState(NEW_CARD);
  const [cardDetails, setCardDetails] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setCardsLoading(true);
      try {
        const list = await getSavedCardsApi();
        if (!alive) return;
        const cards = Array.isArray(list) ? list : [];
        setSavedCards(cards);
        setSelectedCardId(cards.length ? cards[0].id : NEW_CARD);
      } catch (_) {
        if (alive) { setSavedCards([]); setSelectedCardId(NEW_CARD); }
      }
      if (alive) setCardsLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const isNew = selectedCardId === NEW_CARD;

  const handlePay = async () => {
    setError('');
    const savedCard = !isNew ? savedCards.find((c) => c.id === selectedCardId) : null;
    let pmId = savedCard?.stripe_payment_method_id || null;
    if (isNew) {
      if (!StripeAvailable || typeof stripe.createPaymentMethod !== 'function') {
        setError(tr('cart.paymentUnavailable', 'Paiement par nouvelle carte indisponible dans cette version (build requis).'));
        return;
      }
      if (!cardDetails?.complete) {
        setError(tr('cart.cardIncomplete', 'Renseignez une carte valide.'));
        return;
      }
    } else if (!pmId) {
      setError(tr('cart.cardDeclined', 'Carte refusée.'));
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      try { await createStripeCustomerApi(); } catch (_) {}
      if (isNew) {
        const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({ paymentMethodType: 'Card' });
        if (pmError || !paymentMethod?.id) {
          setError(pmError?.message || tr('cart.cardDeclined', 'Carte refusée.'));
          return;
        }
        pmId = paymentMethod.id;
      }
      const list = Array.isArray(orders) ? orders : [];
      for (const ord of list) {
        let res;
        try {
          res = await payOrderApi({ orderId: ord.orderId, paymentMode: 'card', payment_method_id: pmId });
        } catch (e) {
          setError(e?.message || tr('cart.paymentFailed', 'Le paiement a échoué.'));
          return;
        }
        let ok;
        if (!res || res.status === false) {
          if (res?.data?.requires_action && res?.data?.client_secret) {
            ok = await finalisePaymentIntent(res.data, stripe.handleNextAction);
          } else {
            ok = false;
          }
        } else {
          ok = await finalisePaymentIntent(res.data, stripe.handleNextAction);
        }
        if (!ok) {
          setError(tr('cart.paymentFailed', 'Le paiement a échoué.'));
          return;
        }
      }
      onSuccess && onSuccess();
    } catch (e) {
      setError(e?.message || tr('cart.paymentError', 'Erreur de paiement.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const Row = ({ id, label, sub, icon }) => {
    const on = selectedCardId === id;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => { setError(''); setSelectedCardId(id); }} style={[styles.optRow, on && styles.optRowOn]}>
        <Ionicons name={icon} size={20} color={on ? BRAND : '#8A94A6'} />
        <View style={{ flex: 1 }}>
          <Text style={styles.optLabel}>{label}</Text>
          {sub ? <Text style={styles.optSub}>{sub}</Text> : null}
        </View>
        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? BRAND : '#C7CFD9'} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{tr('cart.payByCard', 'Paiement par carte')}</Text>
        <Text style={styles.total}>{totalLabel}</Text>
        <Text style={styles.subtotalNote}>{tr('cart.amountConfirmedByShop', 'Montant indicatif. Frais et total définitifs confirmés par la boutique.')}</Text>

        <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingVertical: 2 }} showsVerticalScrollIndicator={false}>
          {cardsLoading ? (
            <ActivityIndicator style={{ marginVertical: 18 }} color={BRAND} />
          ) : (
            <>
              {savedCards.map((card) => (
                <Row
                  key={String(card.id)}
                  id={card.id}
                  icon="card"
                  label={`${(card.brand || 'Card').toUpperCase()} ${card.last4 ? `•••• ${card.last4}` : ''}`}
                  sub={card.exp_month && card.exp_year ? `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year % 100).padStart(2, '0')}` : ''}
                />
              ))}
              <Row id={NEW_CARD} icon="add-circle-outline" label={tr('cart.newCard', 'Nouvelle carte')} sub="" />
              {isNew ? (
                CardField ? (
                  <CardField
                    postalCodeEnabled={false}
                    placeholders={{ number: '4242 4242 4242 4242' }}
                    cardStyle={{ backgroundColor: '#FFFFFF', textColor: '#0F1B2B', borderColor: '#E3E8EF', borderWidth: 1, borderRadius: 12 }}
                    style={styles.cardField}
                    onCardChange={(d) => setCardDetails(d)}
                  />
                ) : (
                  <Text style={styles.err}>{tr('cart.paymentUnavailable', 'Paiement par nouvelle carte indisponible dans cette version (build requis).')}</Text>
                )
              ) : null}
            </>
          )}
        </ScrollView>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <TouchableOpacity activeOpacity={0.9} onPress={handlePay} disabled={busy || cardsLoading} style={[styles.payBtn, (busy || cardsLoading) && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.payTxt}>{tr('cart.payNow', 'Payer maintenant')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { if (!busy) onCancel && onCancel(); }} style={styles.cancelBtn}>
          <Text style={styles.cancelTxt}>{tr('cart.cancel', 'Annuler')}</Text>
        </TouchableOpacity>

        <Text style={styles.secure}>
          <Ionicons name="shield-checkmark" size={12} color="#8A94A6" /> {tr('cart.securedByStripe', 'Paiement sécurisé par Stripe')}
        </Text>
      </View>
    </View>
  );
}

export default function CardPaymentModal({ visible, orders, totalLabel, t, onSuccess, onCancel }) {
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={() => onCancel && onCancel()}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <CardPaymentInner orders={orders} totalLabel={totalLabel} t={t} onSuccess={onSuccess} onCancel={onCancel} />
      </StripeProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E3E8EF', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F1B2B', textAlign: 'center' },
  total: { fontSize: 15, fontWeight: '700', color: BRAND, textAlign: 'center', marginTop: 4 },
  subtotalNote: { fontSize: 11.5, color: '#8A94A6', textAlign: 'center', marginTop: 3, marginBottom: 10, paddingHorizontal: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F9FB', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EEF1F5' },
  optRowOn: { borderColor: BRAND, backgroundColor: 'rgba(9,215,170,0.06)' },
  optLabel: { fontSize: 15, fontWeight: '700', color: '#0F1B2B' },
  optSub: { fontSize: 12.5, color: '#8A94A6', marginTop: 2 },
  cardField: { width: '100%', height: 50, marginTop: 2, marginBottom: 6 },
  err: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 2 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 16, height: 54, marginTop: 12 },
  payTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelTxt: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  secure: { fontSize: 11.5, color: '#8A94A6', textAlign: 'center', marginTop: 2 },
});
