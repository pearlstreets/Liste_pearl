// Écran de paiement carte (Option A) — miroir fidèle du flux prod d'AppUser
// (createPaymentMethod → POST /payment/user/order/payment/ → reprise 3DS via
// handleNextAction, réconciliation is_paid côté serveur/webhook).
//
// Ne s'affiche QUE dans un build natif : App.js ne monte ce modal que si
// StripeAvailable est vrai (faux en Expo Go). Toutes les références Stripe passent
// par services/stripeNative.js (guarded require) → aucun crash en Expo Go.
import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STRIPE_PUBLISHABLE_KEY } from '../services/config';
import { StripeAvailable, StripeProvider, useStripe, CardField } from '../services/stripeNative';
import { createStripeCustomerApi, payOrderApi } from '../services/payment';

const BRAND = '#09d7aa';

// Finalise une charge dont le PaymentIntent a été créé+confirmé côté serveur.
// Gère uniquement la reprise 3DS et les branches succeeded / échec. Copie de
// AppUser Payment/index.js:186-233.
async function finalisePaymentIntent(data, handleNextAction) {
  const status = data?.status;
  const clientSecret = data?.client_secret;
  const requiresAction =
    data?.requires_action ||
    status === 'requires_action' ||
    status === 'requires_source_action';
  if (requiresAction && clientSecret) {
    const { paymentIntent, error } = await handleNextAction(clientSecret);
    if (error) return false;
    return paymentIntent?.status === 'succeeded';
  }
  if (status === 'succeeded') return true;
  return false;
}

export default function CardPaymentModal({ visible, orders, totalLabel, t, onSuccess, onCancel }) {
  const tr = (k, fb) => (typeof t === 'function' ? t(k, fb) : fb);
  const stripe = useStripe() || {};
  const [cardDetails, setCardDetails] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    if (visible) { setError(''); setBusy(false); busyRef.current = false; setCardDetails(null); }
  }, [visible]);

  const handlePay = async () => {
    if (!StripeAvailable || typeof stripe.createPaymentMethod !== 'function') {
      setError(tr('cart.paymentUnavailable', 'Paiement carte indisponible dans cette version (build requis).'));
      return;
    }
    if (!cardDetails?.complete) {
      setError(tr('cart.cardIncomplete', 'Renseignez une carte valide.'));
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      // S'assure que le Stripe Customer existe (best-effort, comme AppUser).
      try { await createStripeCustomerApi(); } catch (_) {}

      // 1) Tokenise la carte en PaymentMethod (routage Connect côté serveur).
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({ paymentMethodType: 'Card' });
      if (pmError || !paymentMethod?.id) {
        setError(pmError?.message || tr('cart.cardDeclined', 'Carte refusée.'));
        return;
      }

      // 2) Paie chaque commande (une par boutique) avec ce moyen de paiement.
      //    Le serveur crée+confirme le PaymentIntent Connect et passe is_paid=True.
      const list = Array.isArray(orders) ? orders : [];
      for (const ord of list) {
        let res;
        try {
          res = await payOrderApi({ orderId: ord.orderId, paymentMode: 'card', payment_method_id: paymentMethod.id });
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

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onCancel && onCancel(); }}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{tr('cart.payByCard', 'Paiement par carte')}</Text>
            <Text style={styles.total}>{totalLabel}</Text>

            {CardField ? (
              <CardField
                postalCodeEnabled={false}
                placeholders={{ number: '4242 4242 4242 4242' }}
                cardStyle={{ backgroundColor: '#FFFFFF', textColor: '#0F1B2B', borderColor: '#E3E8EF', borderWidth: 1, borderRadius: 12 }}
                style={styles.cardField}
                onCardChange={(d) => setCardDetails(d)}
              />
            ) : (
              <Text style={styles.err}>{tr('cart.paymentUnavailable', 'Paiement carte indisponible dans cette version (build requis).')}</Text>
            )}

            {error ? <Text style={styles.err}>{error}</Text> : null}

            <TouchableOpacity activeOpacity={0.9} onPress={handlePay} disabled={busy} style={[styles.payBtn, busy && { opacity: 0.6 }]}>
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
      </StripeProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E3E8EF', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F1B2B', textAlign: 'center' },
  total: { fontSize: 15, fontWeight: '700', color: BRAND, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  cardField: { width: '100%', height: 50, marginBottom: 8 },
  err: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 4 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 16, height: 54, marginTop: 12 },
  payTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelTxt: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  secure: { fontSize: 11.5, color: '#8A94A6', textAlign: 'center', marginTop: 2 },
});
