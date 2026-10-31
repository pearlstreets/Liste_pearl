// Découvrir : recherche, filtres, favoris, de saison, "Dans mon frigo" (anti-gaspi), historique.
import React, { memo, useMemo, useState, useDeferredValue, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchRecipes, recipesByPantry, eligibleRecipes, norm, formatEur } from '../../lib/menus';
import { T } from './theme';
import { Chip, Field, Empty, PrimaryButton, GhostButton } from './ui';
import { warningList } from './Sheets';
import RecipeVisual from './RecipeVisual';
import { useMenus } from './MenusContext';
import useT from './useT';

const MODES = ['ideas', 'myRecipes', 'favorites', 'season', 'fridge', 'batch', 'history'];
const MODE_ICON = {
  ideas: 'search',
  myRecipes: 'book',
  favorites: 'heart',
  season: 'leaf',
  fridge: 'snow',
  batch: 'layers',
  history: 'time',
};
const COURSES = ['plat', 'entree', 'dessert', 'petit-dejeuner'];
const QUICK_TAGS = ['rapide', 'leger', 'economique', 'enfants', 'batch', 'sans-cuisson'];

const RecipeRow = memo(function RecipeRow({
  recipe,
  title,
  ingredients,
  meta,
  extra,
  fav,
  onPress,
  onFav,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(recipe.id)}
      style={s.row}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <RecipeVisual recipe={recipe} ingredients={ingredients} height={76} round />
      <View style={{ flex: 1, marginHorizontal: 14 }}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
        {extra ? (
          <Text style={s.rowExtra} numberOfLines={2}>
            {extra}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onFav(recipe.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
      >
        <Ionicons
          name={fav ? 'heart' : 'heart-outline'}
          size={24}
          color={fav ? T.danger : T.faint}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function DiscoverScreen({ onOpenRecipe, onOpenWeek, onAddRecipe, onOpenBatch }) {
  const t = useT();
  const m = useMenus();
  const { recipes, myRecipes, texts, ingredients, favorites, profile, fridge, history, lang } = m;
  const [mode, setMode] = useState('ideas');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [course, setCourse] = useState(null);
  const [tags, setTags] = useState([]);
  const [mine, setMine] = useState(true);
  const [fq, setFq] = useState('');
  const [useUp, setUseUp] = useState([]);

  // Ses propres recettes restent toujours visibles : leurs tags sont inconnus, l'écran avertit.
  const base = useMemo(() => {
    if (mode === 'myRecipes') return myRecipes;
    if (!mine) return recipes;
    const all = eligibleRecipes({ recipes, ingredients, profile }).all;
    const vus = new Set(all.map((r) => r.id));
    return [...all, ...myRecipes.filter((r) => !vus.has(r.id))];
  }, [mode, mine, recipes, myRecipes, ingredients, profile]);
  const month = new Date().getMonth();

  const results = useMemo(() => {
    if (mode === 'fridge' || mode === 'history') return [];
    return searchRecipes(base, {
      query: dq,
      filters: {
        course,
        tags,
        favoritesOnly: mode === 'favorites',
        favorites,
        month: mode === 'season' ? month : undefined,
      },
      titleOf: (r) => texts.recipeTitle(r.id),
      ingredientNameOf: (k) => texts.ingredientName(k),
      limit: 150,
    });
  }, [mode, base, dq, course, tags, favorites, month, texts]);

  const fridgeResults = useMemo(() => {
    if (mode !== 'fridge' || fridge.length === 0) return [];
    return recipesByPantry(base, fridge, {
      ingredients,
      toUseUp: useUp.filter((k) => fridge.includes(k)),
      limit: 40,
    });
  }, [mode, base, fridge, ingredients, useUp]);

  const pickable = useMemo(() => {
    if (mode !== 'fridge') return [];
    const n = norm(fq);
    const out = [];
    for (const key of Object.keys(ingredients)) {
      const ing = ingredients[key];
      if (ing.pantry || fridge.includes(key)) continue;
      const name = texts.ingredientName(key);
      if (n && !norm(name).includes(n)) continue;
      out.push({ key, name, emoji: ing.emoji });
      if (out.length >= 40) break;
    }
    return out;
  }, [mode, fq, ingredients, texts, fridge]);

  const toggleTag = useCallback(
    (x) => setTags((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x])),
    []
  );
  const toggleFridge = useCallback(
    (key) => m.setFridge(fridge.includes(key) ? fridge.filter((k) => k !== key) : [...fridge, key]),
    [m, fridge]
  );

  const metaOf = useCallback(
    (r) => {
      if (r.custom) return t('recipe.minutes', { n: r.timeMin });
      const c = m.costOf(r, Math.max(1, profile.adults + profile.children * 0.6));
      return `${t('recipe.minutes', { n: r.timeMin })} · ${r.kcal} kcal · ${t('week.perPerson', { price: formatEur(c.perPerson, lang) })}`;
    },
    [m, profile, t, lang]
  );

  const renderRecipe = useCallback(
    ({ item }) => {
      const r = item.recipe || item;
      let extra = '';
      if (item.recipe) {
        const miss = item.missing.slice(0, 3).map((k) => texts.ingredientName(k));
        extra =
          item.missing.length === 0
            ? t('fridge.allThere')
            : t('fridge.missing', { list: miss.join(', ') + (item.missing.length > 3 ? '…' : '') });
        if (item.uses.length)
          extra = `${t('fridge.usesUp', { count: item.uses.length })}  ${extra}`;
      }
      const w = r.custom ? m.warningOf(r) : null;
      if (w && w.found) extra = t('myRecipes.rowWarning', { list: warningList(w, t) });
      return (
        <RecipeRow
          recipe={r}
          title={texts.recipeTitle(r.id)}
          ingredients={ingredients}
          meta={
            item.recipe
              ? t('fridge.coverage', { pct: Math.round(item.coverage * 100) }) +
                ' · ' +
                t('recipe.minutes', { n: r.timeMin })
              : metaOf(r)
          }
          extra={extra}
          fav={favorites.includes(r.id)}
          onPress={onOpenRecipe}
          onFav={m.toggleFav}
        />
      );
    },
    [texts, ingredients, favorites, onOpenRecipe, m, metaOf, t]
  );

  const modeBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.modesBar}
      contentContainerStyle={s.modes}
    >
      {MODES.map((x) => (
        <Chip
          key={x}
          icon={MODE_ICON[x]}
          label={t(`discover.modes.${x}`)}
          on={mode === x}
          onPress={() => (x === 'batch' ? onOpenBatch() : setMode(x))}
        />
      ))}
    </ScrollView>
  );

  const filters = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
      >
        {COURSES.map((c) => (
          <Chip
            small
            key={c}
            label={t(`course.${c}`)}
            on={course === c}
            onPress={() => setCourse(course === c ? null : c)}
          />
        ))}
        {QUICK_TAGS.map((x) => (
          <Chip
            small
            key={x}
            label={t(`tags.${x}`)}
            on={tags.includes(x)}
            onPress={() => toggleTag(x)}
          />
        ))}
      </ScrollView>
      <View style={s.mineRow}>
        <Chip
          small
          icon={mine ? 'checkmark' : 'options-outline'}
          label={t('discover.mine')}
          on={mine}
          onPress={() => setMine(!mine)}
        />
      </View>
    </View>
  );

  let header;
  let data = results;
  let empty = null;
  if (mode === 'myRecipes') {
    header = (
      <PrimaryButton
        soft
        icon="add"
        label={t('myRecipes.add')}
        onPress={() => onAddRecipe()}
        style={{ marginBottom: 12 }}
      />
    );
    empty = (
      <Empty
        emoji="📖"
        title={t(myRecipes.length ? 'discover.noResultsTitle' : 'myRecipes.emptyTitle')}
        text={t(myRecipes.length ? 'discover.noResultsText' : 'myRecipes.emptyText')}
      />
    );
  } else if (mode === 'ideas' || mode === 'favorites' || mode === 'season') {
    header = (
      <View>
        {mode === 'season' ? <Text style={s.modeNote}>{t('discover.seasonNote')}</Text> : null}
        {filters}
      </View>
    );
    empty =
      mode === 'favorites' && favorites.length === 0 ? (
        <Empty emoji="💚" title={t('discover.favEmptyTitle')} text={t('discover.favEmptyText')} />
      ) : (
        <Empty emoji="🔎" title={t('discover.noResultsTitle')} text={t('discover.noResultsText')} />
      );
  } else if (mode === 'fridge') {
    data = fridgeResults;
    header = (
      <View>
        <Text style={s.modeNote}>{t('fridge.intro')}</Text>
        {fridge.length ? (
          <View style={{ marginTop: 6 }}>
            <Text style={s.label}>{t('fridge.mine')}</Text>
            <View style={s.wrap}>
              {fridge.map((k) => (
                <Chip
                  key={k}
                  emoji={ingredients[k] && ingredients[k].emoji}
                  icon={useUp.includes(k) ? 'star' : 'star-outline'}
                  label={texts.ingredientName(k)}
                  on={useUp.includes(k)}
                  onPress={() =>
                    setUseUp((u) => (u.includes(k) ? u.filter((x) => x !== k) : [...u, k]))
                  }
                />
              ))}
            </View>
            <Text style={s.tip}>{t('fridge.starTip')}</Text>
            <GhostButton
              icon="close-circle-outline"
              label={t('fridge.clear')}
              onPress={() => {
                m.setFridge([]);
                setUseUp([]);
              }}
            />
          </View>
        ) : null}
        <Text style={s.label}>{t('fridge.add')}</Text>
        <Field
          value={fq}
          onChangeText={setFq}
          placeholder={t('fridge.search')}
          autoCorrect={false}
        />
        <View style={[s.wrap, { marginTop: 12 }]}>
          {pickable.map((x) => (
            <Chip
              key={x.key}
              emoji={x.emoji}
              label={x.name}
              on={false}
              onPress={() => toggleFridge(x.key)}
            />
          ))}
        </View>
        {fridge.length ? (
          <Text style={[s.label, { marginTop: 8 }]}>{t('fridge.results')}</Text>
        ) : null}
      </View>
    );
    empty = fridge.length ? (
      <Empty emoji="🥶" title={t('fridge.noneTitle')} text={t('fridge.noneText')} />
    ) : null;
  }

  if (mode === 'history') {
    const list = [...history].reverse();
    return (
      <View style={{ flex: 1 }}>
        <View style={s.head}>
          <Text style={s.big}>{t('discover.title')}</Text>
        </View>
        {modeBar}
        <FlatList
          data={list}
          keyExtractor={(p, i) => `${p.weekStart || ''}-${p.fingerprint || ''}-${i}`}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, flexGrow: 1 }}
          ListHeaderComponent={<Text style={s.modeNote}>{t('history.intro')}</Text>}
          ListEmptyComponent={
            <Empty emoji="🗓️" title={t('history.emptyTitle')} text={t('history.emptyText')} />
          }
          renderItem={({ item }) => {
            const rs = (item.meals || []).filter((x) => x.recipeId);
            let label = t('history.week');
            try {
              if (item.weekStart) {
                const [y, mo, d] = item.weekStart.split('-').map(Number);
                label = t('week.weekOf', {
                  date: new Date(y, mo - 1, d).toLocaleDateString(lang || undefined, {
                    day: 'numeric',
                    month: 'long',
                  }),
                });
              }
            } catch {}
            const ems = [];
            for (const x of rs) {
              const rec = m.recipeById.get(x.recipeId);
              const ing =
                rec &&
                rec.ingredients &&
                rec.ingredients
                  .map((i) => ingredients[i.key])
                  .find((i) => i && i.emoji && !i.pantry);
              if (ing && !ems.includes(ing.emoji)) ems.push(ing.emoji);
              if (ems.length >= 5) break;
            }
            return (
              <View style={s.hist}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{label}</Text>
                  <Text style={s.rowMeta}>
                    {t('history.meals', { count: rs.length })}
                    {item.budget && item.budget.estimated
                      ? ` · ${formatEur(item.budget.estimated, lang)}`
                      : ''}
                  </Text>
                  <Text style={{ fontSize: 20, marginTop: 6 }}>{ems.join(' ')}</Text>
                </View>
                <PrimaryButton
                  soft
                  icon="repeat"
                  label={t('history.redo')}
                  style={{ minHeight: 44, paddingHorizontal: 14 }}
                  onPress={async () => {
                    await m.refaire(item);
                    onOpenWeek();
                  }}
                />
              </View>
            );
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.head}>
        <Text style={s.big}>{t('discover.title')}</Text>
        {mode !== 'fridge' ? (
          <View style={s.search}>
            <Ionicons name="search" size={18} color={T.faint} style={{ marginRight: 8 }} />
            <Field
              value={q}
              onChangeText={setQ}
              placeholder={t('discover.searchPlaceholder')}
              autoCorrect={false}
              returnKeyType="search"
              style={s.searchInput}
            />
            {q ? (
              <TouchableOpacity
                onPress={() => setQ('')}
                accessibilityLabel={t('common.clear')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={T.faint} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {modeBar}
      <FlatList
        data={data}
        keyExtractor={(i) => (i.recipe ? i.recipe.id : i.id)}
        renderItem={renderRecipe}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, flexGrow: 1 }}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 18, paddingTop: 6 },
  big: { fontSize: 34, fontWeight: '900', color: T.ink, letterSpacing: -0.5 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.borderInput,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  searchInput: { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 12 },
  modesBar: { flexGrow: 0, flexShrink: 0 },
  modes: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  filters: { paddingTop: 6, paddingBottom: 0 },
  mineRow: { flexDirection: 'row', marginBottom: 4 },
  modeNote: { fontSize: 14, color: T.muted, lineHeight: 20, marginVertical: 8 },
  label: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 14, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tip: { fontSize: 12, color: T.faint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadowSm,
  },
  rowTitle: { fontSize: 16, fontWeight: '800', color: T.ink, lineHeight: 21 },
  rowMeta: { fontSize: 13, color: T.muted, marginTop: 3, fontWeight: '600' },
  rowExtra: { fontSize: 12, color: T.brandDark, marginTop: 3, fontWeight: '700' },
  hist: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadowSm,
  },
});
