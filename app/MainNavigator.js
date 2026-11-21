import React from "react";
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter, StyleSheet } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "../components/ui/IoniconsSens";
import MenusScreen from "../components/menus/MenusScreen";
import TabLabel from "../components/menus/TabLabel";
import { THEME } from "../components/commun/theme";
import { KEY_CART } from "../lib/constants";
import ProductsScreen from "../screens/shop/ProductsScreen";
import ShopsScreen from "../screens/shop/ShopsScreen";
import CartScreen from "../screens/cart/CartScreen";
import ListScreen from "../screens/list/ListScreen";
import FakeProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();

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
    "products": { focused: "pricetags",      unfocused: "pricetags-outline" },
    "shops": { focused: "storefront",      unfocused: "storefront-outline" },
    "cart":   { focused: "bag-handle",     unfocused: "bag-handle-outline" }
  };

  const getTabName = (key) => {
    const tabNames = {
      myList: t('tabs.myList'),
      menus: t('tabs.menus'),
      products: t('tabs.products'),
      shops: t('tabs.shops', 'Boutiques'),
      cart: t('tabs.cart'),
      profile: t('tabs.profile')
    };
    return tabNames[key] || key;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleAlign: "center",
        headerTitle: getTabName(route.name),
        tabBarLabel: ({ color, position }) => <TabLabel label={getTabName(route.name)} color={color} position={position} />,
        tabBarActiveTintColor: THEME.ink,
        tabBarInactiveTintColor: THEME.faint,
        tabBarStyle: { height: 88, paddingTop: 8, paddingBottom: 28, backgroundColor: THEME.bg, borderTopColor: THEME.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name] || { focused:"ellipse", unfocused:"ellipse-outline" };
          const name = focused ? iconSet.focused : iconSet.unfocused;
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="myList" component={ListScreen} options={{ headerShown: false }} />
      <Tab.Screen name="menus" component={MenusScreen} options={{ headerShown: false }} />
      <Tab.Screen name="products" component={ProductsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="shops" component={ShopsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="cart" options={{ headerShown: false, tabBarBadge: cartCount > 0 ? cartCount : undefined, tabBarBadgeStyle: { top: -5, end: -8 } }}>{() => <CartScreen isAuth={isAuth} />}</Tab.Screen>
      <Tab.Screen name="profile" options={{ headerShown: false }}>{() => <FakeProfileScreen onLogout={onLogout} isAuth={isAuth} />}</Tab.Screen>
    </Tab.Navigator>
  );
}
