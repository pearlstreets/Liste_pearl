// Onglet Menus : racine. Navigation interne par calques (pas de navigateur supplémentaire).
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, BackHandler, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './theme';
import { Loading, ErrorBox } from './ui';
import { MenusProvider, useMenus } from './MenusContext';
import useT from './useT';
import Onboarding from './Onboarding';
import WeekScreen from './WeekScreen';
import ShoppingScreen from './ShoppingScreen';
import DiscoverScreen from './DiscoverScreen';
import RecipeScreen from './RecipeScreen';
import CookMode from './CookMode';
import BatchScreen from './BatchScreen';
import RecipeEditScreen from './RecipeEditScreen';
import SettingsScreen from './SettingsScreen';
import { onMenuReminderOpen, takePendingMenuReminder } from '../../services/menuReminders';

const TABS = ['week', 'shop', 'discover'];

function Inner({ navigation }) {
  const t = useT();
  const m = useMenus();
  const focused = useIsFocused();
  const [tab, setTab] = useState('week');
  const [stack, setStack] = useState([]); // {type:'recipe',id,mealKey} | {type:'cook',id,persons} | {type:'settings'}

  const push = useCallback((x) => setStack((s) => [...s, x]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  const openRecipe = useCallback((id, mealKey) => push({ type: 'recipe', id, mealKey }), [push]);
  const openCook = useCallback((id, persons) => push({ type: 'cook', id, persons }), [push]);
  const openEdit = useCallback((id) => push({ type: 'recipeEdit', id: id || null }), [push]);
  const openBatch = useCallback(() => push({ type: 'batch' }), [push]);
  const goWeek = useCallback(() => {
    setStack([]);
    setTab('week');
  }, []);
  const goShop = useCallback(() => setTab('shop'), []);

  // Notification de rappel touchée : on arrive sur le bon écran, sans calque par-dessus.
  const { ready, onboarded, recipeById } = m;
  useEffect(() => {
    if (!ready || !onboarded) return undefined;
    const ouvrir = () => {
      const c = takePendingMenuReminder();
      if (!c) return;
      setTab(c.target);
      setStack(
        c.recipeId && recipeById.has(c.recipeId)
          ? [{ type: 'recipe', id: c.recipeId, mealKey: c.mealKey || undefined }]
          : []
      );
    };
    ouvrir();
    return onMenuReminderOpen(ouvrir);
  }, [ready, onboarded, recipeById]);

  useEffect(() => {
    if (!focused) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) {
        pop();
        return true;
      }
      if (tab !== 'week') {
        setTab('week');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [focused, stack.length, tab, pop]);

  if (m.loadError)
    return (
      <View style={s.fill}>
        <ErrorBox text={t('week.error')} onRetry={m.reload} />
      </View>
    );
  if (!m.ready)
    return (
      <View style={s.fill}>
        <Loading label={t('week.composing')} />
      </View>
    );
  if (!m.onboarded) return <Onboarding />;

  const top = stack[stack.length - 1];

  return (
    <View style={s.fill}>
      <View style={s.header}>
        <View style={s.seg}>
          {TABS.map((x) => (
            <TouchableOpacity
              key={x}
              onPress={() => setTab(x)}
              style={[s.segBtn, tab === x && s.segOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === x }}
            >
              <Text
                style={[s.segTxt, tab === x && { color: '#fff' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t(`nav.${x}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => push({ type: 'settings' })}
          style={s.gear}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
        >
          <Ionicons name="settings-outline" size={22} color={T.ink} />
        </TouchableOpacity>
      </View>

      <View style={s.fill}>
        <View style={[s.fill, tab !== 'week' && s.hidden]}>
          <WeekScreen
            navigation={navigation}
            onOpenRecipe={openRecipe}
            onOpenShop={goShop}
            onOpenBatch={openBatch}
          />
        </View>
        <View style={[s.fill, tab !== 'shop' && s.hidden]}>
          <ShoppingScreen navigation={navigation} onOpenPlan={goWeek} />
        </View>
        {tab === 'discover' ? (
          <DiscoverScreen
            onOpenRecipe={openRecipe}
            onOpenWeek={goWeek}
            onAddRecipe={openEdit}
            onOpenBatch={openBatch}
          />
        ) : null}
      </View>

      {top ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]}>
          {top.type === 'recipe' ? (
            <RecipeScreen
              id={top.id}
              mealKey={top.mealKey}
              onClose={pop}
              onCook={openCook}
              onEdit={openEdit}
              navigation={navigation}
            />
          ) : null}
          {top.type === 'cook' ? (
            <CookMode id={top.id} persons={top.persons} onClose={pop} />
          ) : null}
          {top.type === 'batch' ? <BatchScreen onClose={pop} onOpenRecipe={openRecipe} /> : null}
          {top.type === 'recipeEdit' ? <RecipeEditScreen id={top.id} onClose={pop} /> : null}
          {top.type === 'settings' ? <SettingsScreen onClose={pop} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export default function MenusScreen({ navigation }) {
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <MenusProvider>
        <Inner navigation={navigation} />
      </MenusProvider>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8 },
  seg: { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 3 },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 11,
    paddingHorizontal: 4,
  },
  segOn: { backgroundColor: T.brand },
  segTxt: { fontSize: 13, fontWeight: '800', color: T.muted },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
