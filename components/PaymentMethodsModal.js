// Section « Moyens de paiement » — cartes enregistrées (UserSaveCard).
// Lister/supprimer = pur appel API (marche même en Expo Go, donc la carte déjà
// rattachée au compte s'affiche). Ajouter une carte = tokenisation Stripe (SDK
// natif) → n'est actif qu'en build natif ; en Expo Go on l'indique proprement.
// Tout Stripe passe par services/stripeNative.js (guarded require) → aucun crash.
import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Alert, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STRIPE_PUBLISHABLE_KEY } from '../services/config';
import { StripeAvailable, StripeProvider, useStripe, CardField } from '../services/stripeNative';
import { getSavedCardsApi, saveCardApi, deleteSavedCardApi, createStripeCustomerApi } from '../services/payment';

const BRAND = '#09d7aa';

function brandIcon(brand) {
  const b = String(brand || '').toLowerCase();
  if (b.includes('visa')) return 'card';
  if (b.includes('master')) return 'card';
  return 'card-outline';
}

function PaymentMethodsInner({ t, onClose }) {
  const tr = (k, fb) => (typeof t === 'function' ? t(k, fb) : fb);
  const stripe = useStripe() || {};
  const [cards, setCards] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [cardDetails, setCardDetails] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await getSavedCardsApi();
      setCards(Array.isArray(list) ? list : []);
    } catch (_) {
      setCards([]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setError('');
    if (!StripeAvailable || typeof stripe.createPaymentMethod !== 'function') {
      setError(tr('cart.addCardNeedsBuild', "L'ajout de carte nécessite la version complète de l'app."));
      return;
    }
    if (!cardDetails?.complete) {
      setError(tr('cart.cardIncomplete', 'Renseignez une carte valide.'));
      return;
    }
    setBusy(true);
    try {
      try { await createStripeCustomerApi(); } catch (_) {}
      const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({ paymentMethodType: 'Card' });
      if (pmErr || !paymentMethod?.id) {
        setError(pmErr?.message || tr('cart.cardDeclined', 'Carte refusée.'));
        setBusy(false);
        return;
      }
      await saveCardApi(paymentMethod.id);
      setAdding(false);
      setCardDetails(null);
      await load();
    } catch (e) {
      setError(e?.message || tr('cart.paymentError', 'Erreur.'));
    }
    setBusy(false);
  };

  const handleDelete = (card) => {
    Alert.alert(
      tr('cart.deleteCard', 'Supprimer la carte'),
      (card.brand ? `${card.brand} ` : '') + (card.last4 ? `•••• ${card.last4}` : ''),
      [
        { text: tr('cart.cancel', 'Annuler'), style: 'cancel' },
        {
          text: tr('cart.delete', 'Supprimer'),
          style: 'destructive',
          onPress: async () => {
            const prev = cards;
            setCards(cards.filter((c) => c.id !== card.id));
            try { await deleteSavedCardApi(card.id); } catch (e) { setCards(prev); }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headRow}>
          <Text style={styles.title}>{tr('cart.paymentMethods', 'Moyens de paiement')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 26 }} color={BRAND} />
          ) : cards.length === 0 ? (
            <Text style={styles.empty}>{tr('cart.noCards', 'Aucune carte enregistrée.')}</Text>
          ) : (
            cards.map((card) => (
              <View key={String(card.id)} style={styles.cardRow}>
                <View style={styles.cardIcon}>
                  <Ionicons name={brandIcon(card.brand)} size={20} color={BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardBrand}>
                    {(card.brand || 'Card').toUpperCase()} {card.last4 ? `•••• ${card.last4}` : ''}
                  </Text>
                  {!!card.exp_month && !!card.exp_year && (
                    <Text style={styles.cardExp}>
                      {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year % 100).padStart(2, '0')}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDelete(card)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}

          {adding ? (
            <View style={styles.addBox}>
              {CardField ? (
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{ number: '4242 4242 4242 4242' }}
                  cardStyle={{ backgroundColor: '#FFFFFF', textColor: '#0F1B2B', borderColor: '#E3E8EF', borderWidth: 1, borderRadius: 12 }}
                  style={styles.cardField}
                  onCardChange={(d) => setCardDetails(d)}
                />
              ) : (
                <Text style={styles.info}>{tr('cart.addCardNeedsBuild', "L'ajout de carte nécessite la version complète de l'app.")}</Text>
              )}
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <TouchableOpacity activeOpacity={0.9} onPress={handleAdd} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>{tr('cart.saveCard', 'Enregistrer la carte')}</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <TouchableOpacity activeOpacity={0.85} onPress={() => { setError(''); setAdding(true); }} style={styles.addBtn}>
                <Ionicons name="add-circle-outline" size={20} color={BRAND} />
                <Text style={styles.addTxt}>{tr('cart.addCard', 'Ajouter une carte')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <Text style={styles.secure}>
          <Ionicons name="shield-checkmark" size={12} color="#8A94A6" /> {tr('cart.securedByStripe', 'Paiement sécurisé par Stripe')}
        </Text>
      </View>
    </View>
  );
}

export default function PaymentMethodsModal({ visible, t, onClose }) {
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={() => onClose && onClose()}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <PaymentMethodsInner t={t} onClose={onClose} />
      </StripeProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, maxHeight: '82%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E3E8EF', marginBottom: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F1B2B' },
  empty: { color: '#8A94A6', fontSize: 14, textAlign: 'center', marginVertical: 22 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F9FB', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEF1F5' },
  cardIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(9,215,170,0.12)', alignItems: 'center', justifyContent: 'center' },
  cardBrand: { fontSize: 15, fontWeight: '700', color: '#0F1B2B' },
  cardExp: { fontSize: 12.5, color: '#8A94A6', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 4 },
  addTxt: { color: BRAND, fontSize: 15, fontWeight: '700' },
  addBox: { marginTop: 8, backgroundColor: '#F7F9FB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EEF1F5' },
  cardField: { width: '100%', height: 50, marginBottom: 8 },
  info: { color: '#8A94A6', fontSize: 13, textAlign: 'center', marginVertical: 8 },
  err: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 2 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND, borderRadius: 14, height: 50, marginTop: 10 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secure: { fontSize: 11.5, color: '#8A94A6', textAlign: 'center', marginTop: 8 },
});
