import React from "react";
import Modal from '../../../components/DeuxEcrans';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "../../../components/ui/IoniconsSens";
import { INSET_BAS, THEME } from "../../../components/commun/theme";
import { profStyles } from "../../profile/profStyles";
import { fmtDate } from "./useCommandes";

// Carte d'une commande (numéro, statut, boutiques, date, mode, total).
export function CarteCommande({ order, status, t, fmtPrice, onPress }) {
  return (
                <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={profStyles.orderCard}>
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
}

// « Mes commandes » de l'onglet Panier : tout l'historique, dans l'écran
// (pas de fenêtre), le détail s'ouvre au toucher.
export function ListeCommandes({ commandes, t, fmtPrice }) {
  const { orders, setDetailOrder, getOrderStatus, loadOrders } = commandes;
  // Tirer pour rafraîchir (geste seul, aucun élément visuel ajouté).
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { if (typeof loadOrders === 'function') await loadOrders(); } catch (e) {}
    setRefreshing(false);
  }, [loadOrders]);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:32 + INSET_BAS, flexGrow:1, justifyContent: orders.length === 0 ? 'center' : 'flex-start' }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {orders.length === 0 ? (
        <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={profStyles.emptyTitle}>{t('profile.noOrders')}</Text>
        </View>
      ) : orders.map((order) => (
        <CarteCommande key={order.id} order={order} status={getOrderStatus(order)} t={t} fmtPrice={fmtPrice} onPress={() => setDetailOrder(order)} />
      ))}
    </ScrollView>
  );
}

// Bloc « Historique des commandes » du Profil : trois dernières commandes.
export function ApercuCommandes({ commandes, t, fmtPrice }) {
  const { orders, setAllOrdersVisible, setDetailOrder, getOrderStatus } = commandes;
  return (
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
  );
}

// Fenêtre « Toutes les commandes ».
export function ToutesLesCommandes({ commandes, t, fmtPrice }) {
  const { orders, allOrdersVisible, setAllOrdersVisible, setDetailOrder, getOrderStatus } = commandes;
  return (
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
  );
}
