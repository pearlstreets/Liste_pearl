/**
 * CheckoutScreen — pearl-list.
 *
 * Multi-étapes : adresse → mode livraison → paiement → confirmation.
 * Branche les services existants (orders.js, stripe.js) sans réinventer.
 *
 * Navigation: navigation.navigate('Checkout', { cartItems, totalAmount })
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STEPS = ['address', 'delivery', 'payment', 'confirm'];
const BRAND = '#00C29B';

export default function CheckoutScreen({ navigation, route }) {
  const cartItems = route?.params?.cartItems || [];
  const totalAmount = route?.params?.totalAmount || 0;

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState({
    fullName: '', phone: '', street: '', city: '', postalCode: '', country: 'France',
  });
  const [deliveryMethod, setDeliveryMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [submitting, setSubmitting] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const placeOrder = async () => {
    setSubmitting(true);
    try {
      const { processCheckout } = await import('../services/orders');
      const order = await processCheckout({
        items: cartItems,
        address,
        delivery_method: deliveryMethod === 'fast' ? 'delivery_pearl' : 'standard',
        payment_method: paymentMethod,
        total_amount: totalAmount,
      });

      const title = order?.synced ? 'Commande confirmée' : 'Commande enregistrée';
      const message = order?.synced
        ? `Votre commande a été transmise au vendeur. Total : ${totalAmount.toFixed(2)} €`
        : `Commande sauvegardée localement. Paiement et confirmation sur place. Total : ${totalAmount.toFixed(2)} €`;

      Alert.alert(title, message, [
        { text: 'OK', onPress: () => navigation.navigate('List') },
      ]);
    } catch (err) {
      Alert.alert('Erreur', err?.message || 'Échec de la commande, réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const StepIndicator = () => (
    <View style={{ flexDirection: 'row', padding: 16, gap: 8 }}>
      {STEPS.map((label, i) => (
        <View key={label} style={{
          flex: 1, height: 4, borderRadius: 2,
          backgroundColor: i <= step ? BRAND : '#e5e7eb',
        }} />
      ))}
    </View>
  );

  const renderStep = () => {
    if (step === 0) return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Adresse de livraison</Text>
        {[
          ['fullName', 'Nom complet'],
          ['phone', 'Téléphone'],
          ['street', 'Rue + numéro'],
          ['city', 'Ville'],
          ['postalCode', 'Code postal'],
          ['country', 'Pays'],
        ].map(([k, label]) => (
          <View key={k} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14 }}
              value={address[k]}
              onChangeText={(v) => setAddress((a) => ({ ...a, [k]: v }))}
              keyboardType={k === 'phone' || k === 'postalCode' ? 'phone-pad' : 'default'}
              autoCapitalize={k === 'phone' || k === 'postalCode' ? 'none' : 'words'}
            />
          </View>
        ))}
      </View>
    );

    if (step === 1) return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Mode de livraison</Text>
        {[
          { id: 'standard', label: 'Standard', subtitle: '24-48h', fee: '0,00 €' },
          { id: 'fast', label: 'Express Pearl Streets', subtitle: 'Livraison rapide par notre réseau', fee: '4,90 €' },
          { id: 'pickup', label: 'Retrait en boutique', subtitle: 'Disponible immédiatement', fee: '0,00 €' },
        ].map((opt) => {
          const selected = deliveryMethod === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setDeliveryMethod(opt.id)}
              style={{
                padding: 14, borderRadius: 10, marginBottom: 10,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? BRAND : '#e5e7eb',
              }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{opt.subtitle}</Text>
              <Text style={{ fontSize: 13, color: BRAND, marginTop: 4, fontWeight: '600' }}>{opt.fee}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    if (step === 2) return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Paiement</Text>
        {[
          { id: 'card', label: 'Carte bancaire (Stripe)' },
          { id: 'apple_pay', label: 'Apple Pay' },
          { id: 'google_pay', label: 'Google Pay' },
        ].map((opt) => {
          const selected = paymentMethod === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setPaymentMethod(opt.id)}
              style={{
                padding: 14, borderRadius: 10, marginBottom: 10,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? BRAND : '#e5e7eb',
              }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
          Le paiement est sécurisé via Stripe. Aucune donnée bancaire stockée sur nos serveurs.
        </Text>
      </View>
    );

    // step 3 — confirm
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Confirmation</Text>
        <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Adresse</Text>
          <Text style={{ fontSize: 14 }}>{address.fullName}, {address.street}, {address.city} {address.postalCode}</Text>
        </View>
        <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Livraison</Text>
          <Text style={{ fontSize: 14 }}>{deliveryMethod}</Text>
        </View>
        <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Articles ({cartItems.length})</Text>
          <Text style={{ fontSize: 14 }}>{cartItems.map((it) => `${it.quantity || 1}× ${it.name}`).join(', ').slice(0, 100)}</Text>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', textAlign: 'right' }}>
            Total : {totalAmount.toFixed(2)} €
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <TouchableOpacity onPress={() => (step > 0 ? prev() : navigation.goBack())}>
          <Text style={{ fontSize: 28 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', marginLeft: 12 }}>
          Checkout · {step + 1}/{STEPS.length}
        </Text>
      </View>
      <StepIndicator />
      <ScrollView style={{ flex: 1 }}>{renderStep()}</ScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' }}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            onPress={next}
            style={{ backgroundColor: BRAND, padding: 14, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continuer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={placeOrder}
            disabled={submitting}
            style={{ backgroundColor: BRAND, padding: 14, borderRadius: 12, alignItems: 'center', opacity: submitting ? 0.5 : 1 }}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Payer {totalAmount.toFixed(2)} €</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
