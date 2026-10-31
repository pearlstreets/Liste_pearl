// Etat partagé de l'onglet Menus : profil, plan, favoris, notes, frigo, courses.
// Toute la logique vient de lib/menus ; ici on ne fait que charger, brancher et enregistrer.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { InteractionManager, DeviceEventEmitter } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getRecipes,
  getIngredients,
  getTexts,
  normalizeProfile,
  defaultProfile,
  generatePlan,
  swapMeal,
  setFree as planSetFree,
  lockMeal,
  lockedFromPlan,
  eligibleRecipes,
  inSeason,
  buildShoppingList,
  estimateRecipeCost,
  loadProfile,
  saveProfile,
  loadPlan,
  savePlan,
  loadHistory,
  pushHistory,
  clearPlan,
  recomputeCooking,
  loadFavorites,
  toggleFavorite,
  loadNotes,
  setNote as storeNote,
  loadCooked,
  markCooked as storeCooked,
  loadFridge,
  saveFridge,
  loadMeta,
  setMeta,
  markSent,
  pendingLines,
  addToList,
  readMyLists,
  clearAllMenus,
  personsFor,
} from '../../lib/menus';

import { mondayISO, weekTarget, isPastWeek } from '../../lib/menus/weeks';
import { recipeListLines } from '../../lib/menus/recipeList';
import { ingredientQueries } from '../../lib/menus/pearl';

const Ctx = createContext(null);
export const useMenus = () => useContext(Ctx);

export { mondayISO };

/** Empreinte des paquets à envoyer (change dès qu'une quantité change). */
export const linesFingerprint = (lines) =>
  (Array.isArray(lines) ? lines : [])
    .map((l) => `${l.key}:${l.packs}`)
    .sort()
    .join('|');

const hasRecipes = (p) => !!p && Array.isArray(p.meals) && p.meals.some((m) => m && m.recipeId);

export function MenusProvider({ children }) {
  const { i18n } = useTranslation();
  const lang = i18n && i18n.language;
  const texts = useMemo(() => getTexts(lang), [lang]);
  const recipes = useMemo(() => getRecipes(), []);
  const ingredients = useMemo(() => getIngredients(), []);
  const recipeById = useMemo(() => {
    const m = new Map();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [profile, setProfile] = useState(defaultProfile());
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [notes, setNotes] = useState({});
  const [cooked, setCooked] = useState({});
  const [fridge, setFridgeState] = useState([]);
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [removed, setRemoved] = useState([]);
  const [pantryOn, setPantryOn] = useState(false);

  const planRef = useRef(null);
  const genBusy = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const profileRef = useRef(profile);
  planRef.current = plan;
  profileRef.current = profile;

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [pr, pl, hi, fa, no, co, fr, me] = await Promise.all([
        loadProfile(),
        loadPlan(),
        loadHistory(),
        loadFavorites(),
        loadNotes(),
        loadCooked(),
        loadFridge(),
        loadMeta(),
      ]);
      let plan0 = pl || null;
      let hist = hi;
      // Semaine terminée : archivée dans l'historique sans perte, puis retirée de l'écran.
      if (plan0 && isPastWeek(plan0.weekStart)) {
        if (await pushHistory(plan0)) {
          await clearPlan();
          hist = await loadHistory();
          plan0 = null;
        }
      } else if (plan0 && Array.isArray(plan0.meals)) {
        plan0 = { ...plan0, meals: recomputeCooking(plan0.meals) };
      }
      setProfile(normalizeProfile(pr));
      setPlan(plan0);
      setHistory(Array.isArray(hist) ? hist : []);
      setFavorites(Array.isArray(fa) ? fa : []);
      setNotes(no || {});
      setCooked(co || {});
      setFridgeState(Array.isArray(fr) ? fr : []);
      setOnboarded(!!(me && me.onboarded) || !!pl);
    } catch {
      setLoadError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const planProfile = useCallback(
    () => ({ ...profileRef.current, month: new Date().getMonth() }),
    []
  );

  const persist = useCallback(async (next) => {
    if (!next || next === planRef.current) return;
    planRef.current = next;
    setPlan(next);
    await savePlan(next);
  }, []);

  /** Compose (ou recompose) la semaine. Les repas verrouillés sont gardés. Calcul différé après les interactions. */
  const generate = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        if (genBusy.current) return resolve(null);
        genBusy.current = true;
        setBusy(true);
        setGenError(false);
        InteractionManager.runAfterInteractions(() => {
          setTimeout(async () => {
            try {
              const cur = planRef.current;
              const weekStart =
                opts.weekStart ||
                (cur && cur.weekStart && !opts.fresh ? cur.weekStart : weekTarget().start);
              // Changement de semaine : l'ancien plan est gardé dans l'historique.
              if (cur && cur.weekStart && cur.weekStart !== weekStart && (await pushHistory(cur))) {
                setHistory(await loadHistory());
              }
              const locked =
                opts.locked ||
                (!opts.fresh && cur && cur.weekStart === weekStart
                  ? lockedFromPlan(cur)
                  : undefined);
              const next = generatePlan({
                recipes,
                ingredients,
                profile: planProfile(),
                seed: opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9),
                locked,
                weekStart,
              });
              await savePlan(next);
              planRef.current = next;
              setPlan(next);
              setRemoved([]);
              setDirty(false);
              resolve(next);
            } catch {
              setGenError(true);
              resolve(null);
            } finally {
              genBusy.current = false;
              if (mounted.current) setBusy(false);
            }
          }, 40);
        });
      }),
    [recipes, ingredients, planProfile]
  );

  const finishOnboarding = useCallback(
    async (patch) => {
      if (patch) {
        const saved = await saveProfile(patch);
        setProfile(normalizeProfile(saved));
        profileRef.current = normalizeProfile(saved);
      }
      await setMeta({ onboarded: true });
      setOnboarded(true);
      generate({ fresh: true });
    },
    [generate]
  );

  const updateProfile = useCallback(async (patch) => {
    const merged = normalizeProfile({ ...profileRef.current, ...patch });
    profileRef.current = merged;
    setProfile(merged);
    const saved = await saveProfile(patch);
    if (saved) {
      profileRef.current = normalizeProfile(saved);
      setProfile(profileRef.current);
    }
    if (planRef.current) setDirty(true);
  }, []);

  const swap = useCallback(
    async (mealKey, recipeId) => {
      const cur = planRef.current;
      if (!cur) return;
      const next = swapMeal({
        plan: cur,
        mealKey,
        recipeId,
        recipes,
        ingredients,
        profile: planProfile(),
        seed: Math.floor(Math.random() * 1e9),
      });
      await persist(next);
    },
    [recipes, ingredients, planProfile, persist]
  );

  const toggleLock = useCallback(
    async (mealKey) => {
      const cur = planRef.current;
      if (!cur) return;
      const m = cur.meals.find((x) => x.key === mealKey);
      await persist(lockMeal(cur, mealKey, !(m && m.locked)));
    },
    [persist]
  );

  const setFree = useCallback(
    async (mealKey, free) => {
      const cur = planRef.current;
      if (!cur) return;
      const next = planSetFree({
        plan: cur,
        mealKey,
        free,
        recipes,
        ingredients,
        profile: planProfile(),
      });
      await persist(next);
    },
    [recipes, ingredients, planProfile, persist]
  );

  /** 3 idées pour un repas : recettes admises par le foyer, hors celles déjà au menu. */
  const suggest = useCallback(
    (n = 3) => {
      const cur = planRef.current;
      const prof = planProfile();
      const { mains } = eligibleRecipes({ recipes, ingredients, profile: prof });
      const used = new Set(((cur && cur.meals) || []).map((m) => m.recipeId).filter(Boolean));
      let pool = mains.filter((r) => !used.has(r.id));
      const seasonal = pool.filter((r) => inSeason(r, prof.month));
      if (seasonal.length >= n) pool = seasonal;
      const a = pool.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.slice(0, n);
    },
    [recipes, ingredients, planProfile]
  );

  const refaire = useCallback(
    (old) => {
      if (!old || !Array.isArray(old.meals)) return Promise.resolve(null);
      const locked = lockedFromPlan({ meals: old.meals.map((m) => ({ ...m, locked: true })) });
      return generate({ locked, fresh: true });
    },
    [generate]
  );

  const toggleFav = useCallback(async (id) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    const now = await toggleFavorite(id);
    if (now === null) setFavorites(await loadFavorites());
  }, []);
  const setNote = useCallback(async (id, text) => {
    setNotes((n) => {
      const c = { ...n };
      if (text && text.trim()) c[id] = text;
      else delete c[id];
      return c;
    });
    await storeNote(id, text);
  }, []);
  const markCooked = useCallback(async (id) => {
    await storeCooked(id);
    setCooked(await loadCooked());
  }, []);
  const setFridge = useCallback(async (keys) => {
    setFridgeState(keys);
    await saveFridge(keys);
  }, []);

  const resetAll = useCallback(async () => {
    await clearAllMenus();
    planRef.current = null;
    setPlan(null);
    setHistory([]);
    setFavorites([]);
    setNotes({});
    setCooked({});
    setFridgeState([]);
    setProfile(defaultProfile());
    profileRef.current = defaultProfile();
    setOnboarded(false);
    setRemoved([]);
    setDirty(false);
  }, []);

  // Déconnexion / suppression du compte : on oublie tout ce qui est en mémoire (aucune fuite vers le compte suivant).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('USER_DATA_CLEARED', () => {
      resetAll();
    });
    return () => sub.remove();
  }, [resetAll]);

  /* ------------------------------- courses ------------------------------- */

  const shopping = useMemo(() => {
    if (!hasRecipes(plan)) return null;
    try {
      return buildShoppingList({ plan, recipes, ingredients, profile, includePantry: pantryOn });
    } catch {
      return null;
    }
  }, [plan, recipes, ingredients, profile, pantryOn]);

  const removedSet = useMemo(() => new Set(removed), [removed]);
  const toggleHave = useCallback(
    (key) => setRemoved((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key])),
    []
  );

  const activeLines = useMemo(
    () => (shopping ? shopping.lines.filter((l) => !removedSet.has(l.key)) : []),
    [shopping, removedSet]
  );

  /** Ajoute à une liste Pearl (null = liste active) ; ne renvoie que la différence avec ce qui est déjà parti. */
  const sendToList = useCallback(
    async (listId, lines) => {
      const all = Array.isArray(lines) ? lines : [];
      if (all.length === 0) return { status: 'empty', count: 0 };
      try {
        let id = listId;
        if (id == null) id = (await readMyLists()).activeId;
        const fp = linesFingerprint(all);
        const nameOf = (l) => texts.ingredientName(l.key);
        const matchOf = (l) => ingredientQueries(l.key, getTexts('fr').ingredientName(l.key));
        const diff = await pendingLines(id, all, nameOf);
        if (diff.length === 0) return { status: 'already', count: 0, listId: id };
        const r = await addToList(id, diff, {
          nameOf,
          matchOf,
          fingerprint: fp,
          force: true,
        });
        if (r.status === 'ok') {
          try {
            DeviceEventEmitter.emit('LISTS_UPDATED'); // ListScreen recharge la liste active
          } catch {}
          const packs = {};
          for (const l of all) packs[l.key] = l.packs;
          await markSent(id, packs);
          if (hasRecipes(planRef.current)) {
            try {
              await pushHistory(planRef.current);
              setHistory(await loadHistory());
            } catch {}
          }
        }
        return { ...r, count: (r.added || 0) + (r.merged || 0), delta: diff.length < all.length };
      } catch {
        return { status: 'error', count: 0 };
      }
    },
    [texts]
  );

  /** Ajoute UNE recette, aux portions choisies, à la liste active (fusion sans doublon). */
  const sendRecipeToList = useCallback(
    async (recipeId, persons) => {
      try {
        const recipe = recipeById.get(recipeId);
        const { lines, fingerprint } = recipeListLines({
          recipe,
          persons,
          recipes,
          ingredients,
          profile: profileRef.current,
        });
        if (lines.length === 0) return { status: 'empty', count: 0 };
        const r = await addToList(null, lines, {
          nameOf: (l) => texts.ingredientName(l.key),
          matchOf: (l) => ingredientQueries(l.key, getTexts('fr').ingredientName(l.key)),
          fingerprint,
        });
        if (r.status === 'ok') {
          try {
            DeviceEventEmitter.emit('LISTS_UPDATED');
          } catch {}
        }
        return { ...r, count: (r.added || 0) + (r.merged || 0) };
      } catch {
        return { status: 'error', count: 0 };
      }
    },
    [recipeById, recipes, ingredients, texts]
  );

  const costOf = useCallback(
    (recipe, persons) => {
      try {
        return estimateRecipeCost(recipe, ingredients, persons, {
          pantry: profileRef.current.pantry,
        });
      } catch {
        return { total: 0, perPerson: 0, unknown: 0 };
      }
    },
    [ingredients]
  );

  const value = useMemo(
    () => ({
      ready,
      loadError,
      reload: load,
      onboarded,
      finishOnboarding,
      lang,
      texts,
      recipes,
      ingredients,
      recipeById,
      profile,
      updateProfile,
      plan,
      busy,
      genError,
      dirty,
      generate,
      swap,
      toggleLock,
      setFree,
      suggest,
      refaire,
      history,
      favorites,
      toggleFav,
      notes,
      setNote,
      cooked,
      markCooked,
      fridge,
      setFridge,
      shopping,
      activeLines,
      removedSet,
      toggleHave,
      pantryOn,
      setPantryOn,
      sendToList,
      sendRecipeToList,
      costOf,
      resetAll,
      persons: (d, s) => personsFor(profile, d, s),
    }),
    [
      ready,
      loadError,
      load,
      onboarded,
      finishOnboarding,
      lang,
      texts,
      recipes,
      ingredients,
      recipeById,
      profile,
      updateProfile,
      plan,
      busy,
      genError,
      dirty,
      generate,
      swap,
      toggleLock,
      setFree,
      suggest,
      refaire,
      history,
      favorites,
      toggleFav,
      notes,
      setNote,
      cooked,
      markCooked,
      fridge,
      setFridge,
      shopping,
      activeLines,
      removedSet,
      toggleHave,
      pantryOn,
      sendToList,
      sendRecipeToList,
      costOf,
      resetAll,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
