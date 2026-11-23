import React from "react";
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "../components/ui/IoniconsSens";
import MenusScreen from "../components/menus/MenusScreen";
import TabLabel from "../components/menus/TabLabel";
import { THEME } from "../components/commun/theme";
import { MARCHE } from "../components/ui/marche";
import { KEY_CART } from "../lib/constants";
import AcheterScreen from "../screens/shop/AcheterScreen";
import { ROUTE_ACHETER, ANCIENNES_ROUTES } from "./onglets";
import CartScreen from "../screens/cart/CartScreen";
import ListScreen from "../screens/list/ListScreen";
import FakeProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();

// Anciens onglets 'products' et 'shops' : écrans cachés de la barre, qui ouvrent
// aussitôt Acheter sur le bon segment (navigate('products') et navigate('shops')
// marchent toujours, comme le reste des paramètres passés).
const redirection = (segment) => function AncienOnglet({ navigation, route }) {
  useFocusEffect(React.useCallback(() => {
    try { navigation.navigate(ROUTE_ACHETER, { ...(route.params || {}), segment, n: Date.now() }); } catch {}
  }, [navigation, route.params]));
  return <View style={{ flex: 1, backgroundColor: THEME.bg }} />;
};
const AncienProduits = redirection(ANCIENNES_ROUTES.products);
const AncienneBoutiques = redirection(ANCIENNES_ROUTES.shops);
const CACHE = { headerShown: false, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } };

export default function MainNavigator({ onLogout, isAuth }) {
  const { t } = useTranslation();

  // Compteur du panier pour le badge de l'onglet Panier (source : KEY_CART).
  const [cartCount, setCartCount] = React.useState(0);
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_CART);
        const arr = raw ? JSON.parse(raw) : [];
        const n = Array.isArray(arr) ? arr.reduce((s, it) => s + Number(it.qty || 1), 0) : 0;
        if (mounted) setCartCount(n);
      } catch (e) { if (mounted) setCartCount(0); }
    };
    load();
    // CART_UPDATED = ajout externe (recharge aussi l'écran Panier) ; CART_COUNT_CHANGED
    // = mutation interne au Panier (badge seul, ne recharge PAS l'écran pour préserver
    // la sélection de l'utilisateur). Le badge écoute les deux.
    const sub = DeviceEventEmitter.addListener('CART_UPDATED', load);
    const sub2 = DeviceEventEmitter.addListener('CART_COUNT_CHANGED', load);
    return () => { mounted = false; sub.remove(); sub2.remove(); };
  }, []);

  const ICONS = {
    "profile": { focused: "person", unfocused: "person-outline" },
    "myList": { focused: "reorder-three", unfocused: "reorder-three-outline" },
    // Optimiseur = comparaison de prix (icône distincte du Panier)
    "menus": { focused: "restaurant", unfocused: "restaurant-outline" },
    "acheter": { focused: "storefront",      unfocused: "storefront-outline" },
    "cart":   { focused: "bag-handle",     unfocused: "bag-handle-outline" }
  };

  const getTabName = (key) => {
    const tabNames = {
      myList: t('tabs.myList'),
      menus: t('tabs.menus'),
      acheter: t('tabs.acheter'),
      cart: t('tabs.cart'),
      profile: t('tabs.profile')
    };
    return tabNames[key] || key;
  };

  return (
    <Tab.Navigator
      // Retour Android : onglet précédent, plus toujours Ma Liste.
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleAlign: "center",
        headerTitle: getTabName(route.name),
        tabBarLabel: ({ color, position }) => <TabLabel label={getTabName(route.name)} color={color} position={position} />,
        tabBarActiveTintColor: THEME.accent,
        tabBarInactiveTintColor: THEME.ink,
        tabBarStyle: { height: 88, paddingTop: 8, paddingBottom: 28, backgroundColor: THEME.card, borderTopColor: THEME.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name] || { focused:"ellipse", unfocused:"ellipse-outline" };
          const name = focused ? iconSet.focused : iconSet.unfocused;
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="myList" component={ListScreen} options={{ headerShown: false }} />
      <Tab.Screen name="cart" options={{ headerShown: false, tabBarBadge: cartCount > 0 ? cartCount : undefined, tabBarBadgeStyle: { top: -5, end: -8, backgroundColor: MARCHE.jaune, color: THEME.ink } }}>{() => <CartScreen isAuth={isAuth} />}</Tab.Screen>
      <Tab.Screen name="acheter" component={AcheterScreen} options={{ headerShown: false }} />
      <Tab.Screen name="menus" component={MenusScreen} options={{ headerShown: false }} />
      <Tab.Screen name="profile" options={{ headerShown: false }}>{() => <FakeProfileScreen onLogout={onLogout} isAuth={isAuth} />}</Tab.Screen>
      <Tab.Screen name="products" component={AncienProduits} options={CACHE} />
      <Tab.Screen name="shops" component={AncienneBoutiques} options={CACHE} />
    </Tab.Navigator>
  );
}
