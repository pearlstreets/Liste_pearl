import { useTranslation } from "react-i18next";
import Modal from "../../components/DeuxEcrans";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { THEME } from "../../components/commun/theme";
import { useCurrency } from "../../components/commun/devise";
import { cartStyles } from "./cartStyles";

const OrderTracker = ({ visible, onClose, onCancel, items, total, mode, orderNo, notices, paid, onTrack }) => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const isCollect = mode === 'collect';
  // Suivi HONNÊTE : la commande est réellement créée à la confirmation. On
  // n'affiche donc plus de fausse progression temporisée ni de « Livré » simulé.
  // Seule l'étape « confirmée » est validée ; la suite est le parcours à venir,
  // suivi en temps réel dans Panier, Mes commandes.
  const steps = isCollect ? [
    { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
    { icon: "storefront", label: t('orderStatus.preparing') },
    { icon: "bag-handle", label: t('orderStatus.ready') },
    { icon: "checkmark-done", label: t('orderStatus.collected') },
  ] : [
    { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
    { icon: "storefront", label: t('orderStatus.preparing') },
    { icon: "bicycle", label: t('orderStatus.onTheWay') },
    { icon: "home", label: t('orderStatus.delivered') },
  ];
  const currentStep = 0; // « confirmée » uniquement — les étapes suivantes sont informatives

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={cartStyles.screen} edges={[]}>
        {/* Header */}
        <View style={cartStyles.trackerHeader}>
          <View style={cartStyles.trackerHeaderRow}>
            <Text style={cartStyles.trackerTitle}>{t('cart.orderTracking')}</Text>
            <TouchableOpacity onPress={onCancel || onClose} activeOpacity={0.8} style={cartStyles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.muted} />
            </TouchableOpacity>
          </View>
          <Text style={cartStyles.trackerOrderNo}>N° {orderNo || '-'}</Text>
        </View>

        {/* Confirmation (état honnête, sans ETA simulée) */}
        <View style={cartStyles.etaWrap}>
          <View style={cartStyles.etaCircle}>
            <Ionicons name="checkmark" size={50} color={THEME.terra} />
          </View>
          <Text style={cartStyles.etaCaption}>{t('cart.orderConfirmedTitle', 'Commande confirmée')}</Text>
          <Text style={[cartStyles.stepLabel, cartStyles.stepLabelOff, { textAlign: 'center', marginTop: 6, paddingHorizontal: 34 }]}>
            {isCollect ? t('cart.orderConfirmedCollectCart', 'Votre commande sera préparée pour le retrait. Suivez son statut dans Mes commandes, en haut du panier.') : t('cart.orderConfirmedDeliveryCart', 'Un livreur va prendre en charge votre commande. Suivez son statut dans Mes commandes, en haut du panier.')}
          </Text>
        </View>

        {/* Steps */}
        <View style={cartStyles.stepsWrap}>
          {steps.map((step, i) => (
            <View key={i} style={cartStyles.stepItem}>
              <View style={[cartStyles.stepDot, i <= currentStep ? cartStyles.stepDotOn : cartStyles.stepDotOff]}>
                <Ionicons name={step.icon} size={18} color={i <= currentStep ? '#fff' : THEME.faint} />
              </View>
              {i < steps.length - 1 && (
                <View style={[cartStyles.stepConnector, { backgroundColor: i < currentStep ? THEME.terra : THEME.border }]} />
              )}
              <View style={cartStyles.stepLabelWrap}>
                <Text style={[cartStyles.stepLabel, i <= currentStep ? cartStyles.stepLabelOn : cartStyles.stepLabelOff]}>{step.label}</Text>
              </View>
              {i <= currentStep && (
                <Ionicons name="checkmark" size={18} color={THEME.terra} />
              )}
            </View>
          ))}
        </View>

        {/* Order summary */}
        <ScrollView style={cartStyles.trackerSummaryScroll} showsVerticalScrollIndicator={false}>
          <View style={cartStyles.trackerSummaryCard}>
            <Text style={cartStyles.trackerSummaryTitle}>{t('cart.summary')}</Text>
            {/* Écarts de stock à la création de la course : lignes neutres. */}
            {Array.isArray(notices) && notices.length ? (
              <View style={{ marginBottom: 10 }}>
                {notices.map((n, i) => <Text key={i} style={cartStyles.stockNotice}>{String(n)}</Text>)}
              </View>
            ) : null}
            {(() => {
              const grouped = {};
              (items || []).forEach(it => {
                const shop = it.shop || '__other__';
                if (!grouped[shop]) grouped[shop] = [];
                grouped[shop].push(it);
              });
              return Object.entries(grouped).map(([shop, shopItems], si) => (
                <View key={si} style={{ marginBottom: 10 }}>
                  <View style={cartStyles.trackerShopRow}>
                    <Ionicons name="storefront" size={14} color={THEME.terra} />
                    <Text style={cartStyles.trackerShopName}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                  </View>
                  {shopItems.map((it, i) => (
                    <View key={i} style={cartStyles.trackerLineRow}>
                      <Text style={cartStyles.trackerLineName}>{it.qty || 1}x {t('productNames.' + (it.name || it.title), { defaultValue: it.name || it.title })}{it.variant && it.variant.title ? ` (${it.variant.title})` : ''}</Text>
                      <Text style={cartStyles.trackerLinePrice}>{fmtPrice(Number(it.price || 0) * Number(it.qty || 1))}</Text>
                    </View>
                  ))}
                </View>
              ));
            })()}
            <View style={cartStyles.trackerTotalRow}>
              <Text style={cartStyles.trackerTotalLabel}>{t('cart.total')}</Text>
              <Text style={cartStyles.trackerTotalValue}>{fmtPrice(total || 0)}</Text>
            </View>
            <View style={[cartStyles.trackerLineRow, { paddingLeft: 0, marginTop: 8 }]}>
              <Text style={cartStyles.trackerLineName}>{t('cart.payment', 'Paiement')}</Text>
              <Text style={cartStyles.trackerLinePrice}>{paid ? t('cart.paidByCard', 'Payé par carte') : isCollect ? t('cart.payAtPickup', 'À payer au retrait') : t('cart.payAtDelivery', 'À payer à la livraison')}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Terminé — toujours disponible (la commande est déjà enregistrée) */}
        <View style={cartStyles.trackerFooter}>
          {typeof onTrack === 'function' ? (
            <TouchableOpacity onPress={onTrack} activeOpacity={0.9} style={[cartStyles.ghostBtn, { flexDirection: 'row', marginBottom: 10 }]} accessibilityRole="button" accessibilityLabel={t('cart.trackMyOrder', 'Suivre ma commande')}>
              <Ionicons name="navigate-outline" size={18} color="#1C1917" />
              <Text style={[cartStyles.ghostBtnTxt, { marginLeft: 8 }]}>{t('cart.trackMyOrder', 'Suivre ma commande')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose} activeOpacity={0.9} style={cartStyles.primaryBtn} accessibilityRole="button" accessibilityLabel={t('cart.done')}>
            <Ionicons name="checkmark-circle" size={20} color="#1C1917" />
            <Text style={cartStyles.primaryBtnTxt}>{t('cart.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default OrderTracker;
