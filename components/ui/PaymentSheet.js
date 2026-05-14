/**
 * PaymentSheet — wraps @stripe/stripe-react-native CardField
 *
 * Graceful degradation:
 *  - In Expo Go (no native build): shows an info banner explaining that payment
 *    requires the TestFlight / Play Store build.
 *  - In a native build: shows the real Stripe card form.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, Pressable, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { processPayment } from '../../services/stripe';

const BRAND = '#00C29B';

// Lazy-load the Stripe SDK — not available in Expo Go
let StripeProvider = null;
let CardField = null;
let useStripe = null;
try {
  const sdk = require('@stripe/stripe-react-native');
  StripeProvider = sdk.StripeProvider;
  CardField = sdk.CardField;
  useStripe = sdk.useStripe;
} catch (_) {}

const IS_STRIPE_AVAILABLE = !!(StripeProvider && CardField && useStripe);

// ─── Inner card form (requires native Stripe SDK) ──────────────────────────────

function StripeCardForm({ totalLabel, amountCents, currency, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const [cardReady, setCardReady] = React.useState(false);
  const [cardDetails, setCardDetails] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const handlePay = async () => {
    if (!cardDetails?.complete) return;
    setLoading(true);
    try {
      // 1. Create PaymentIntent on backend — returns clientSecret
      const result = await processPayment({ amountCents, currency });

      if (!result?.clientSecret) {
        Alert.alert(
          t('payment.errorTitle') || 'Erreur',
          result?.message || 'Impossible de créer le paiement.',
        );
        setLoading(false);
        return;
      }

      // 2. Confirm payment via SDK — handles SCA/3DS natively
      const { paymentIntent, error } = await stripe.confirmPayment(result.clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert(t('payment.errorTitle') || 'Paiement refusé', error.message || 'Votre paiement a été refusé.');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess({ payment_intent_id: paymentIntent.id });
      } else {
        Alert.alert(t('payment.errorTitle') || 'Paiement refusé', 'Votre paiement a été refusé.');
      }
    } catch (err) {
      Alert.alert(t('payment.errorTitle') || 'Erreur', err?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 24, paddingBottom: 40 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
        {t('payment.title') || 'Paiement sécurisé'}
      </Text>
      <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        {t('payment.subtitle') || 'Entrez vos coordonnées bancaires. Paiement chiffré par Stripe.'}
      </Text>

      {/* Total */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 }}>
        <Text style={{ fontSize: 14, color: '#374151' }}>{t('cart.total') || 'Total'}</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: BRAND }}>{totalLabel}</Text>
      </View>

      {/* Stripe card field */}
      <CardField
        postalCodeEnabled={false}
        onCardChange={(details) => {
          setCardDetails(details);
          setCardReady(details?.complete === true);
        }}
        style={{ height: 52, marginBottom: 20 }}
        cardStyle={{
          backgroundColor: '#f9fafb',
          textColor: '#111',
          borderWidth: 1,
          borderColor: '#e5e7eb',
          borderRadius: 10,
        }}
      />

      {/* Stripe badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Ionicons name="lock-closed" size={12} color="#9ca3af" />
        <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
          {t('payment.securedBy') || 'Sécurisé par Stripe'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={onCancel}
          style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#6b7280', fontWeight: '600' }}>{t('common.cancel') || 'Annuler'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePay}
          disabled={!cardReady || loading}
          style={{ flex: 2, height: 48, borderRadius: 12, backgroundColor: (!cardReady || loading) ? '#9ca3af' : BRAND, alignItems: 'center', justifyContent: 'center' }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('payment.payNow') || 'Payer maintenant'}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Fallback when Stripe SDK is not available (Expo Go) ──────────────────────

function ExpoGoFallback({ onCancel }) {
  const { t } = useTranslation();
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <Ionicons name="card-outline" size={56} color="#d1d5db" style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 }}>
        {t('payment.nativeBuildRequired') || 'Paiement disponible dans la version complète'}
      </Text>
      <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
        {t('payment.nativeBuildHint') || 'Le paiement par carte nécessite la version TestFlight ou Play Store de l\'app. Votre commande est bien enregistrée.'}
      </Text>
      <TouchableOpacity
        onPress={onCancel}
        style={{ backgroundColor: BRAND, borderRadius: 12, height: 48, paddingHorizontal: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.ok') || 'OK'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────

export function PaymentModal({
  visible,
  onClose,
  onSuccess,
  orderId,
  totalLabel,
  publishableKey,
  amountCents,
  currency,
}) {
  const inner = IS_STRIPE_AVAILABLE ? (
    <StripeProvider publishableKey={publishableKey || ''}>
      <StripeCardForm
        totalLabel={totalLabel}
        amountCents={amountCents}
        currency={currency}
        onSuccess={(res) => { onSuccess(res); onClose(); }}
        onCancel={onClose}
      />
    </StripeProvider>
  ) : (
    <ExpoGoFallback onCancel={onClose} />
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          onPress={() => {}}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e5e5', alignSelf: 'center', marginTop: 14, marginBottom: 4 }} />
          {inner}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
