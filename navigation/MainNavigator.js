import React from 'react';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BRAND } from '../constants/brand';
import ListScreen from '../screens/ListScreen';
import ProductsScreen from '../screens/ProductsScreen';
import CartScreen from '../screens/CartScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  profile: { focused: "person", unfocused: "person-outline" },
  myList: { focused: "reorder-three", unfocused: "reorder-three-outline" },
  products: { focused: "cart", unfocused: "cart-outline" },
  favorites: { focused: "heart", unfocused: "heart-outline" },
  cart: { focused: "bag-handle", unfocused: "bag-handle-outline" },
};

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
      <Tab.Screen name="myList">{() => <ListScreen isGuest={isGuest} onLogin={onLogin} />}</Tab.Screen>
      <Tab.Screen name="products" component={ProductsScreen} />
      <Tab.Screen name="cart">{() => <CartScreen isGuest={isGuest} onLogin={onLogin} />}</Tab.Screen>
      <Tab.Screen name="favorites">{() => <FavoritesScreen isGuest={isGuest} onLogin={onLogin} />}</Tab.Screen>
      <Tab.Screen name="profile">{() => <ProfileScreen onLogout={onLogout} isGuest={isGuest} onLogin={onLogin} />}</Tab.Screen>
    </Tab.Navigator>
  );
}
