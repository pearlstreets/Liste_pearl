import React from "react";
import { annulationPossible } from "../../../lib/annulation";
import { ajouterAuPanier, champsCommande } from "../../../lib/panier";
import { DELIVERY_STATUS } from "../../../services/delivery";
import LiveDeliveryMap from "../../../components/LiveDeliveryMap";
import { DeviceEventEmitter } from 'react-native';
import Modal from '../../../components/DeuxEcrans';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "../../../components/ui/IoniconsSens";
import { SERIF, TAILLES } from "../../../components/ui/marche";
import { INSET_BAS, THEME } from "../../../components/commun/theme";
import { ProductThumb } from "../../../components/commun/ProductImage";
import { Square } from "../../../components/commun/Coches";
import { KEY_CART } from "../../../lib/constants";
import { profStyles } from "../../profile/profStyles";
import { fmtDate, cleanPickupDate } from "./useCommandes";

// Détail d'une commande (carte live, livreur, code, pourboire, note, signalement,
// annulation) et fenêtre « Recommander », au même niveau.
export function DetailCommande({ commandes, t, fmtPrice, navigation }) {
  const { setAllOrdersVisible, detailOrder, setDetailOrder, reorderVisible, setReorderVisible, reorderItems, setReorderItems, deliveryStatuses, tipLoading, submitPostTip, submitRating, submitReport, annulation, annulerCommande, getOrderStatus } = commandes;
  return (
    <>
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
    </>
  );
}
