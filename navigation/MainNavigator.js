import React, { Suspense, lazy } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BRAND } from '../constants/brand';

// Lazy-load 5 tab screens — keep startup bundle minimal, load each tab on first focus.
const ListScreen = lazy(() => import('../screens/ListScreen'));
const ProductsScreen = lazy(() => import('../screens/ProductsScreen'));
const CartScreen = lazy(() => import('../screens/CartScreen'));
const FavoritesScreen = lazy(() => import('../screens/FavoritesScreen'));
const ProfileScreen = lazy(() => import('../screens/ProfileScreen'));

const Tab = createBottomTabNavigator();

const ICONS = {
  profile: { focused: "person", unfocused: "person-outline" },
  myList: { focused: "reorder-three", unfocused: "reorder-three-outline" },
  products: { focused: "cart", unfocused: "cart-outline" },
  favorites: { focused: "heart", unfocused: "heart-outline" },
  cart: { focused: "bag-handle", unfocused: "bag-handle-outline" },
};

function ScreenFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={BRAND} />
    </View>
  );
}

const wrap = (Component, props = {}) => (
  <Suspense fallback={<ScreenFallback />}>
    <Component {...props} />
  </Suspense>
);

export default function MainNavigator({ onLogout, isGuest = false, onLogin }) {
  const { t } = useTranslation();

  const getTabName = (key) => {
    const tabNames = {
      myList: t('tabs.myList'),
      products: t('tabs.products'),
      favorites: t('tabs.favorites'),
      cart: t('tabs.cart'),
      profile: t('tabs.profile'),
    };
    return tabNames[key] || key;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleAlign: "center",
        headerTitle: getTabName(route.name),
        tabBarLabel: getTabName(route.name),
        tabBarActiveTintColor: BRAND,
        tabBarStyle: { height: 62 },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name] || { focused: "ellipse", unfocused: "ellipse-outline" };
          const name = focused ? iconSet.focused : iconSet.unfocused;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="myList">{() => wrap(ListScreen, { isGuest, onLogin })}</Tab.Screen>
      <Tab.Screen name="products">{() => wrap(ProductsScreen)}</Tab.Screen>
      <Tab.Screen name="cart">{() => wrap(CartScreen, { isGuest, onLogin })}</Tab.Screen>
      <Tab.Screen name="favorites">{() => wrap(FavoritesScreen, { isGuest, onLogin })}</Tab.Screen>
      <Tab.Screen name="profile">{() => wrap(ProfileScreen, { onLogout, isGuest, onLogin })}</Tab.Screen>
    </Tab.Navigator>
  );
}
