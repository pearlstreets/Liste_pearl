// Découvrir : recherche, filtres, favoris, de saison, "Dans mon frigo" (anti-gaspi), historique.
import React, {
  memo,
  useMemo,
  useState,
  useDeferredValue,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  searchRecipes,
  recipesByPantry,
  eligibleRecipes,
  searchCatalog,
  pantryCatalog,
  buildSearchIndex,
  eligibleCatalog,
  catalogActive,
  idFromRow,
  norm,
  formatEur,
  CUISINES,
  PLENTY_VEG,
  genHealthAsync,
  personsFor,
} from '../../lib/menus';
import { T } from './theme';
import { Chip, Field, Empty, PrimaryButton, GhostButton } from './ui';
import { warningList } from './Sheets';
import { AddToWeekSheet } from './MonthScreen';
import RecipeVisual from './RecipeVisual';
import { useMenus, conflictList } from './MenusContext';
import useT from './useT';
import { isolerPrix } from './MealCard';
import { isolerUnitesLatines } from '../../lib/texteBidi';

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
const QUICK_TAGS = ['leger', 'economique', 'enfants', 'batch', 'sans-cuisson'];
// Temps maximal (minutes) des puces « Rapide » et « Moins de 30 min » : une seule active à la fois.
const TIME_CHIPS = [
  { max: 20, label: 'discover.quick20' },
  { max: 30, label: 'discover.under30' },
];
const PAGE = 30; // recettes ajoutées à chaque fin de liste
const FRIDGE_LIMIT = 60;
const FRIDGE_MAX_MISSING = 5;
// Etat du bouton d'ajout par recette ET par liste de manquants : si le frigo change, le bouton se réarme.
const fridgeKey = (it) => `${it.recipe.id}:${it.missing.join(',')}`;
const DEBOUNCE_MS = 130; // attente apres la derniere frappe avant de relancer la recherche

// Ordre sans recherche : les recettes relues d'abord, puis les générées dans un ordre mélangé stable pour la journée.
const feedSeed = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// Une entrée de liste est un numéro : >= 0 case générée, < 0 recette de result.legacy[-v - 1].
const recipeOf = (res, v, catalog) => (v < 0 ? res.legacy[-v - 1] : catalog.getRow(v));
const idOfRef = (res, v) => (v < 0 ? res.legacy[-v - 1].id : idFromRow(v));

// Objets constants : aucune nouvelle valeur par ligne a chaque rendu.
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const RecipeRow = memo(function RecipeRow({
  recipe,
  title,
  ingredients,
  meta,
  extra,
  fav,
  onPress,
  onFav,
  onAddWeek,
  addLabel,
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
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={s.rowMeta} numberOfLines={2}>
          {meta}
        </Text>
        {extra ? (
          <Text style={s.rowExtra} numberOfLines={2}>
            {extra}
          </Text>
        ) : null}
      </View>
      {onAddWeek ? (
        <TouchableOpacity
          onPress={() => onAddWeek(recipe)}
          hitSlop={HIT}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={{ marginRight: 12 }}
        >
          <Ionicons name="calendar-outline" size={24} color={T.faint} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity onPress={() => onFav(recipe.id)} hitSlop={HIT} accessibilityRole="button">
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
  const catalog = m.recipeById;
  const useCat = catalogActive(catalog);
  const [mode, setMode] = useState('ideas');
  const [addRecipe, setAddRecipe] = useState(null);
  const [q, setQ] = useState('');
  // Recherche relancee 130 ms apres la derniere frappe (pas a chaque lettre), puis calcul differe ;
  // champ vide : liste complete tout de suite, sans attendre.
  const [qStable, setQStable] = useState('');
  useEffect(() => {
    if (!q) {
      setQStable('');
      return undefined;
    }
    const id = setTimeout(() => setQStable(q), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);
  const qDiff = useDeferredValue(qStable);
  const dq = q ? qDiff : '';
  const [course, setCourse] = useState(null);
  const [tags, setTags] = useState([]);
  // Repères santé, tous éteints par défaut : équilibré, temps maximal, plein de légumes, une cuisine du monde.
  const [balanced, setBalanced] = useState(false);
  const [maxTime, setMaxTime] = useState(null);
  const [plentyVeg, setPlentyVeg] = useState(false);
  const [cuisine, setCuisine] = useState(null);
  // Recherche ou filtre changé : la liste repart tout en haut, sur les premiers résultats.
  // Deja en haut : pas de defilement force (un defilement a chaque recherche, espace de plus d'une demi-seconde,
  // fait croire a la liste qu'elle est lente a se mettre a jour).
  const listRef = useRef(null);
  const offsetRef = useRef(0);
  useEffect(() => {
    if (listRef.current && offsetRef.current > 0) {
      listRef.current.scrollToOffset({ offset: 0, animated: false });
      offsetRef.current = 0;
    }
  }, [mode, dq, course, tags, balanced, maxTime, plentyVeg, cuisine]);
  const onScrollEnd = useCallback((e) => {
    offsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);
  const [mine, setMine] = useState(true);
  const [fq, setFq] = useState('');
  const [useUp, setUseUp] = useState([]);

  // Ses propres recettes restent toujours visibles : leurs tags sont inconnus, l'écran avertit.
  // Catalogue complet : la partie écrite à la main (objets) et les cases admises (masque), jamais 12 000 objets.
  const base = useMemo(() => {
    if (mode === 'myRecipes') return { legacy: myRecipes, allowed: null };
    if (useCat) {
      if (!mine) return { legacy: undefined, allowed: null };
      const el = eligibleCatalog(catalog, ingredients, profile);
      return {
        legacy: [...el.legacyAll, ...myRecipes.filter((r) => !el.legacyAllIds.has(r.id))],
        allowed: el.gen.all,
      };
    }
    if (!mine) return { legacy: recipes, allowed: null };
    const all = eligibleRecipes({ recipes, ingredients, profile }).all;
    const vus = new Set(all.map((r) => r.id));
    return { legacy: [...all, ...myRecipes.filter((r) => !vus.has(r.id))], allowed: null };
  }, [mode, mine, useCat, catalog, recipes, myRecipes, ingredients, profile]);
  const month = new Date().getMonth();
  const seed = useMemo(feedSeed, []);
  const tl = texts.lang || lang;

  // Index de titres de la langue : construit par tranches à l'ouverture, pour que la première frappe soit rapide.
  useEffect(() => {
    if (!useCat) return undefined;
    let off = false;
    buildSearchIndex(tl, {
      yieldFn: () => new Promise((r) => setTimeout(r, 0)),
      cancelled: () => off,
    })
      // puis les repères santé du catalogue (légumes, cuisine), pour que la première puce réponde tout de suite
      .then(() =>
        off
          ? null
          : genHealthAsync(undefined, {
              yieldFn: () => new Promise((r) => setTimeout(r, 0)),
              cancelled: () => off,
            })
      )
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [useCat, tl]);

  const results = useMemo(() => {
    if (mode === 'fridge' || mode === 'history') return null;
    const opts = {
      query: dq,
      filters: {
        course,
        tags,
        favoritesOnly: mode === 'favorites',
        favorites,
        month: mode === 'season' ? month : undefined,
        maxTimeMin: maxTime || undefined,
        balanced: balanced || undefined,
        minVeg: plentyVeg ? PLENTY_VEG : undefined,
        cuisine: cuisine || undefined,
      },
      titleOf: (r) => texts.recipeTitle(r.id),
      ingredientNameOf: (k) => texts.ingredientName(k),
    };
    if (useCat && mode !== 'myRecipes') {
      try {
        const r = searchCatalog({
          ...opts,
          catalog,
          lang: tl,
          legacyList: base.legacy,
          allowedRows: base.allowed,
          shuffleSeed: seed,
          diversify: true,
        });
        return { total: r.total, refs: Array.from(r.refs), legacy: r.legacy };
      } catch {
        /* repli : recettes écrites à la main seules */
      }
    }
    const list = searchRecipes(base.legacy || recipes, opts);
    return { total: list.length, refs: list.map((_, i) => -(i + 1)), legacy: list };
  }, [
    mode,
    base,
    dq,
    course,
    tags,
    balanced,
    maxTime,
    plentyVeg,
    cuisine,
    favorites,
    month,
    texts,
    useCat,
    catalog,
    tl,
    seed,
    recipes,
  ]);

  // Pagination : 30 recettes d'abord, 30 de plus à chaque fin de liste ; repart à 30 quand les résultats changent.
  // La clé de pagination ignore les favoris hors du mode favoris : cocher un cœur ne ramène pas la liste à 30.
  const favDep = mode === 'favorites' ? favorites : null;
  const pageKey = useMemo(
    () => ({}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      mode,
      base,
      dq,
      course,
      tags,
      balanced,
      maxTime,
      plentyVeg,
      cuisine,
      month,
      texts,
      useCat,
      catalog,
      tl,
      seed,
      recipes,
      favDep,
    ]
  );
  const [page, setPage] = useState({ res: null, n: PAGE });
  const shown = results && page.res === pageKey ? page.n : PAGE;
  const onEnd = useCallback(() => {
    if (results && shown < results.total) setPage({ res: pageKey, n: shown + PAGE });
  }, [results, shown, pageKey]);
  const pageData = useMemo(() => (results ? results.refs.slice(0, shown) : []), [results, shown]);

  // Avec ce que j'ai : placard du foyer compté comme présent, préférences rapide et équilibré respectées,
  // classement par nombre d'ingrédients manquants (aucun d'abord, puis 1, 2...).
  const fridgeResults = useMemo(() => {
    if (mode !== 'fridge' || fridge.length === 0) return [];
    const toUseUp = useUp.filter((k) => fridge.includes(k));
    const pf = profile && profile.prefs;
    const filters = {
      maxTimeMin: pf && pf.quick > 0 ? pf.quick : undefined,
      balanced: pf && pf.balanced === true ? true : undefined,
    };
    const common = {
      ingredients,
      toUseUp,
      filters,
      basics: profile && Array.isArray(profile.pantry) ? profile.pantry : [],
      byMissing: true,
      maxMissing: FRIDGE_MAX_MISSING,
      limit: FRIDGE_LIMIT,
    };
    if (useCat) {
      try {
        return pantryCatalog({
          ...common,
          catalog,
          legacyList: base.legacy,
          allowedRows: base.allowed,
          have: fridge,
        }).items;
      } catch {
        /* repli ci-dessous */
      }
    }
    return recipesByPantry(base.legacy || recipes, fridge, common);
  }, [mode, base, fridge, ingredients, useUp, useCat, catalog, recipes, profile]);

  // Ajout des seuls ingrédients manquants à la liste (portions du foyer, sans doublon).
  const [fridgeAdded, setFridgeAdded] = useState({});
  const addMissing = useCallback(
    async (item) => {
      const id = fridgeKey(item);
      setFridgeAdded((a) => (a[id] === 'busy' ? a : { ...a, [id]: 'busy' }));
      let st = 'error';
      try {
        const r = await m.sendRecipeToList(item.recipe.id, personsFor(profile, null, null), item.missing);
        st = r && (r.status === 'ok' || r.status === 'already' || r.status === 'empty') ? 'ok' : 'error';
      } catch {
        st = 'error';
      }
      setFridgeAdded((a) => ({ ...a, [id]: st }));
    },
    [m, profile]
  );

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

  // Ligne d'infos d'une recette, calculee une fois par recette tant que foyer, langue et prix ne changent pas
  // (le defilement et un coeur coche ne refont pas le calcul du cout de chaque ligne visible).
  const { costOf, warningOf, conflictOf, toggleFav } = m;
  const metaOf = useMemo(() => {
    const cache = new Map();
    return (r) => {
      const hit = cache.get(r.id);
      if (hit !== undefined && hit.r === r) return hit.v;
      let v;
      if (r.custom) v = t('recipe.minutes', { n: r.timeMin });
      else {
        // portions du foyer (personnes renseignées comprises), comme la semaine
        const c = costOf(r, personsFor(profile, null, null));
        v = `${t('recipe.minutes', { n: r.timeMin })} · ${r.kcal} ${t('kcal')} · ${t('week.perPerson', { price: formatEur(c.perPerson, lang) })}`;
        v = isolerPrix(isolerUnitesLatines(v, lang), lang);
      }
      cache.set(r.id, { r, v });
      return v;
    };
  }, [costOf, profile, t, lang]);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const renderRecipe = useCallback(
    ({ item: entry }) => {
      const item = typeof entry === 'number' ? null : entry;
      const r = item ? item.recipe || item : results && recipeOf(results, entry, catalog);
      if (!r) return null;
      let extra = '';
      if (item && item.recipe) {
        const miss = item.missing.slice(0, 3).map((k) => texts.ingredientName(k));
        extra =
          item.missing.length === 0
            ? t('fridge.allThere')
            : t('fridge.missing', { list: miss.join(', ') + (item.missing.length > 3 ? '…' : '') });
        if (item.uses.length)
          extra = `${t('fridge.usesUp', { count: item.uses.length })}  ${extra}`;
      }
      // allergie, régime ou ingrédient écarté : signalé aussi sur les recettes du catalogue
      const w = r.custom ? warningOf(r) : conflictOf(r);
      if (w && w.found)
        extra = t('myRecipes.rowWarning', { list: r.custom ? warningList(w, t) : conflictList(w, t) });
      const row = (
        <RecipeRow
          recipe={r}
          title={texts.recipeTitle(r.id)}
          ingredients={ingredients}
          meta={
            item && item.recipe
              ? t('fridge.have', { have: item.have.length, total: item.have.length + item.missing.length }) +
                ' · ' +
                t('recipe.minutes', { n: r.timeMin })
              : metaOf(r)
          }
          extra={extra}
          fav={favSet.has(r.id)}
          onPress={onOpenRecipe}
          onFav={toggleFav}
          onAddWeek={setAddRecipe}
          addLabel={t('month.addTitle')}
        />
      );
      if (!item || !item.recipe || item.missing.length === 0) return row;
      const st = fridgeAdded[fridgeKey(item)];
      return (
        <View>
          {row}
          <View style={{ alignItems: 'flex-start', marginBottom: 8 }}>
            <GhostButton
              icon={st === 'ok' ? 'checkmark-circle-outline' : 'cart-outline'}
              label={st === 'ok' ? t('fridge.addedMissing') : t('fridge.addMissing')}
              onPress={st === 'ok' || st === 'busy' ? undefined : () => addMissing(item)}
            />
          </View>
        </View>
      );
    },
    [texts, ingredients, favSet, onOpenRecipe, warningOf, conflictOf, toggleFav, metaOf, t, results, catalog, fridgeAdded, addMissing]
  );

  // Cle stable : l'id de la recette (jamais la position), meme fonction tant que les resultats ne changent pas.
  const keyOf = useCallback(
    (i) => {
      if (typeof i === 'number') return results ? idOfRef(results, i) : String(i);
      return i.recipe ? i.recipe.id : i.id;
    },
    [results]
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
        <Chip
          small
          label={t('discover.balanced')}
          on={balanced}
          onPress={() => setBalanced(!balanced)}
        />
        {TIME_CHIPS.map((x) => (
          <Chip
            small
            key={x.max}
            label={t(x.label)}
            on={maxTime === x.max}
            onPress={() => setMaxTime(maxTime === x.max ? null : x.max)}
          />
        ))}
        <Chip
          small
          label={t('discover.plentyVeg')}
          on={plentyVeg}
          onPress={() => setPlentyVeg(!plentyVeg)}
        />
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
      >
        <Text style={[s.tip, { alignSelf: 'center', marginRight: 8 }]}>
          {t('discover.cuisinesTitle')}
        </Text>
        {CUISINES.map((x) => (
          <Chip
            small
            key={x}
            label={t(`discover.cuisines.${x}`)}
            on={cuisine === x}
            onPress={() => setCuisine(cuisine === x ? null : x)}
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
  let data = pageData;
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
                      ? ` · ${isolerPrix(formatEur(item.budget.estimated, lang), lang)}`
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
        ref={listRef}
        data={data}
        keyExtractor={keyOf}
        renderItem={renderRecipe}
        onEndReached={mode === 'fridge' ? undefined : onEnd}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, flexGrow: 1 }}
        onScrollEndDrag={onScrollEnd}
        onMomentumScrollEnd={onScrollEnd}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
      />
      {addRecipe ? (
        <AddToWeekSheet recipe={addRecipe} onClose={() => setAddRecipe(null)} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 18, paddingTop: 6 },
  big: { fontSize: 34, fontWeight: '600', color: T.ink, letterSpacing: -0.5 },
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
  label: { fontSize: 15, fontWeight: '600', color: T.ink, marginTop: 14, marginBottom: 10 },
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
  rowBody: { flex: 1, marginHorizontal: 14 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: T.ink, lineHeight: 21 },
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
